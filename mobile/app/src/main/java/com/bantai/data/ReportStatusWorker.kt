package com.bantai.data

import android.content.Context
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
import com.bantai.data.local.ReportBlocks
import com.bantai.data.model.REPORT_REJECTED
import com.bantai.data.model.REPORT_VALIDATED
import com.bantai.data.remote.ReportsApi
import com.bantai.data.remote.SmsApi
import com.bantai.util.BlockHelper
import com.bantai.util.DefaultSmsApp
import com.bantai.util.NotificationHelper
import com.bantai.util.SmsSourceId
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

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
    override suspend fun doWork(): Result = runLock.withLock { check() }

    // The periodic and on-open runs can overlap; both would read the same saved
    // statuses and notify (and consume the report-block) twice.
    @Suppress("ReturnCount") // signed out, network failure, done
    private suspend fun check(): Result {
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
        val byMessage = reports.associateBy { it.messageId }
        plan.notify.forEach { (key, status) ->
            val alert = byMessage[key]
            val unblocked =
                if (status == REPORT_REJECTED && alert != null) {
                    val localId = SmsSourceId.localRowId(applicationContext, alert.sourceId)
                    refileReviewed(localId, alert.report?.reviewedLabel)
                    liftReportBlock(token, alert, localId)
                } else {
                    null
                }
            NotificationHelper.sendReportReviewed(
                applicationContext,
                key,
                accepted = status == REPORT_VALIDATED,
                unblocked = unblocked,
            )
        }
        prefs
            .edit()
            .putStringSet(KEY_STATUSES, plan.remember.mapTo(mutableSetOf()) { "${it.key}$SEPARATOR${it.value}" })
            .putBoolean(KEY_BASELINED, true)
            .apply()
        return Result.success()
    }

    /**
     * The team didn't confirm this Scam report, so the block that came only
     * from reporting it is lifted (a block the user chose stays). Returns the
     * sender that was unblocked, or null when there was nothing to undo.
     */
    @Suppress("ReturnCount") // not a scam report, nothing to undo, then unblock
    private suspend fun liftReportBlock(
        token: String,
        alert: SmsApi.AlertSummary,
        localId: Long?,
    ): String? {
        if (alert.report?.reportedLabel != "Scam") return null
        // The backend sends no sender on reports; the phone's own row (found
        // from the sourceId it sent at ingest) has it.
        val sender =
            localId
                ?.let { applicationContext.container.smsRepository.getMessagesByIds(setOf(it)) }
                ?.firstOrNull()
                ?.sender
                .orEmpty()
        // Android only lets the default SMS app touch its block list; without the
        // role the delete silently fails, so keep the record and say nothing.
        if (sender.isBlank() || !DefaultSmsApp.isDefault(applicationContext)) return null
        if (!ReportBlocks.consume(applicationContext, sender)) return null
        BlockHelper.unblockSender(applicationContext, token, sender)
        val stillBlocked = withContext(Dispatchers.IO) { BlockHelper.isBlocked(applicationContext, sender) }
        return sender.takeUnless { stillBlocked }
    }

    /**
     * On a rejection the reviewer says what the text really is (Ham or Spam);
     * the message moves there. Null (older backend, or no label given) leaves it.
     */
    private suspend fun refileReviewed(
        localId: Long?,
        reviewedLabel: String?,
    ) {
        if (reviewedLabel != "Ham" && reviewedLabel != "Spam") return
        MessageReports.refile(applicationContext, localId, reviewedLabel)
    }

    companion object {
        private const val PERIODIC_WORK = "report-status-periodic"
        private const val ON_OPEN_WORK = "report-status-on-open"
        private const val PREFS = "report_status"
        private const val KEY_STATUSES = "statuses"
        private const val KEY_BASELINED = "baselined"
        private const val SEPARATOR = "\t"
        private const val INTERVAL_MINUTES = 15L

        private val runLock = Mutex()

        private val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

        /** A different account signed in: start its report history fresh (no burst of old reviews). */
        fun clearState(context: Context) {
            context
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .clear()
                .apply()
        }

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
