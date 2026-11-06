package com.bantai.data

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.bantai.container
import com.bantai.data.model.Retention
import com.bantai.util.BlockHelper
import com.bantai.util.DefaultSmsApp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/**
 * Daily cleanup per [Retention]: empties Recently Deleted after 30 days,
 * deletes blocked senders' texts after 30 days, and drops Scam Wave matches
 * older than 90 days. Keeps the app's stores (and the SMS database) from
 * growing forever, which testers noticed as the app getting heavier.
 *
 * Deleting from the SMS database needs BantAI to be the default SMS app; when
 * it isn't, those steps are skipped (not faked by hiding rows) and retried on
 * the next run.
 */
class RetentionWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result =
        withContext(Dispatchers.IO) {
            val now = System.currentTimeMillis()
            val container = applicationContext.container
            val canDelete =
                DefaultSmsApp.isDefault(applicationContext) && container.smsRepository.hasReadSmsPermission()
            val purged = HashSet<Long>()
            if (canDelete) {
                val expired = Retention.expiredDeletedIds(container.deletedMessagesStore.deletedEntries.first(), now)
                if (expired.isNotEmpty()) {
                    container.smsWriter.deletePermanently(expired)
                    container.deletedMessagesStore.clear(expired)
                    purged += expired
                }
                purged += purgeOldBlockedMessages(now)
            }
            if (purged.isNotEmpty()) {
                container.classificationStore.remove(purged)
                container.backendMessageIdStore.remove(purged)
                container.campaignMatchStore.remove(purged)
            }
            pruneOldWaveMatches(now)
            Result.success()
        }

    private suspend fun purgeOldBlockedMessages(now: Long): Set<Long> {
        val container = applicationContext.container
        val cutoff = Retention.cutoff(Retention.BLOCKED_MESSAGES_DAYS, now)
        val blockedSet = container.blockedSendersStore.current().blocked
        val blockedBySender = HashMap<String, Boolean>()
        val ids =
            container.smsRepository
                .getInboxMessages()
                .filter { msg ->
                    !msg.isOutgoing &&
                        msg.timestamp < cutoff &&
                        blockedBySender.getOrPut(msg.sender) {
                            BlockHelper.isSenderBlocked(applicationContext, msg.sender, blockedSet)
                        }
                }.mapTo(HashSet()) { it.id }
        if (ids.isNotEmpty()) container.smsWriter.deletePermanently(ids)
        return ids
    }

    private suspend fun pruneOldWaveMatches(now: Long) {
        val container = applicationContext.container
        val matched = container.campaignMatchStore.snapshot().keys
        if (matched.isEmpty() || !container.smsRepository.hasReadSmsPermission()) return
        val cutoff = Retention.cutoff(Retention.SCAM_WAVE_DAYS, now)
        val old =
            container.smsRepository
                .getMessagesByIds(matched)
                .filter { it.timestamp < cutoff }
                .map { it.id }
        if (old.isNotEmpty()) container.campaignMatchStore.remove(old)
    }

    companion object {
        private const val PERIODIC_WORK = "retention-daily"
        private const val INTERVAL_HOURS = 24L

        /** Keeps the daily cleanup scheduled. Safe to call on every app start. */
        fun schedule(context: Context) {
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                PERIODIC_WORK,
                ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<RetentionWorker>(INTERVAL_HOURS, TimeUnit.HOURS).build(),
            )
        }
    }
}
