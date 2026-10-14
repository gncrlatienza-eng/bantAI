package com.bantai.data

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.bantai.container
import com.bantai.data.model.REPORT_VALIDATED
import com.bantai.data.remote.ReportsApi
import com.bantai.util.NotificationHelper
import com.bantai.util.SmsSourceId
import kotlinx.coroutines.flow.first
import java.util.concurrent.TimeUnit

private const val TAG = "ReportStatusWorker"

/**
 * Tells the user when one of their reports has been reviewed. Polls
 * GET /reports/mine (there is no push channel) about every 15 minutes --
 * Android's minimum for background work -- and once whenever the app opens.
 * Same shape as TipCheckWorker.
 */
class ReportStatusWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {
    @Suppress("ReturnCount") // signed out, network failure, done
    override suspend fun doWork(): Result {
        val token =
            applicationContext.container.userPreferences.userData
                .first()
                .authToken
        if (token.isEmpty()) return Result.success()
        val reports = ReportsApi.mine(token).getOrNull() ?: return Result.retry()
        val current =
            reports
                .mapNotNull { alert -> alert.report?.let { alert.messageId to it.status } }
                .toMap()
        val prefs = applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val previous =
            if (prefs.getBoolean(KEY_BASELINED, false)) {
                prefs
                    .getStringSet(KEY_STATUSES, emptySet())
                    .orEmpty()
                    .mapNotNull { entry ->
                        val parts = entry.split(SEPARATOR, limit = 2)
                        if (parts.size == 2) parts[0] to parts[1] else null
                    }.toMap()
            } else {
                null
            }
        val plan = ReportStatusNotifications.plan(previous, current)
        plan.notify.forEach { (key, status) ->
            NotificationHelper.sendReportReviewed(applicationContext, key, accepted = status == REPORT_VALIDATED)
        }
        // A rejected report says what the text really is: file it there.
        val byMessage = reports.filter { it.report != null }.associateBy { it.messageId }
        ReportStatusNotifications
            .refiles(plan, byMessage.mapValues { it.value.report?.reviewedLabel })
            .forEach { (messageId, label) ->
                val localId = SmsSourceId.localRowId(applicationContext, byMessage[messageId]?.sourceId)
                // Best effort: a failed move must not fail the worker before the
                // statuses below are saved, or the retry would notify again.
                runCatching { MessageReports.refile(applicationContext, localId, label) }
                    .onFailure { Log.w(TAG, "Couldn't refile reviewed report $messageId", it) }
            }
        prefs
            .edit()
            .putStringSet(KEY_STATUSES, plan.remember.mapTo(mutableSetOf()) { "${it.key}$SEPARATOR${it.value}" })
            .putBoolean(KEY_BASELINED, true)
            .apply()
        return Result.success()
    }

    companion object {
        private const val PERIODIC_WORK = "report-status-periodic"
        private const val ON_OPEN_WORK = "report-status-on-open"
        private const val PREFS = "report_status"
        private const val KEY_STATUSES = "statuses"
        private const val KEY_BASELINED = "baselined"
        private const val SEPARATOR = "\t"
        private const val INTERVAL_MINUTES = 15L

        private val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

        /** Keeps the periodic check scheduled and runs one now. Safe to call on every app start. */
        fun schedule(context: Context) {
            val workManager = WorkManager.getInstance(context)
            val periodic =
                PeriodicWorkRequestBuilder<ReportStatusWorker>(INTERVAL_MINUTES, TimeUnit.MINUTES)
                    .setConstraints(online)
                    .build()
            workManager.enqueueUniquePeriodicWork(PERIODIC_WORK, ExistingPeriodicWorkPolicy.KEEP, periodic)
            workManager.enqueueUniqueWork(
                ON_OPEN_WORK,
                ExistingWorkPolicy.REPLACE,
                OneTimeWorkRequestBuilder<ReportStatusWorker>().setConstraints(online).build(),
            )
        }
    }
}
