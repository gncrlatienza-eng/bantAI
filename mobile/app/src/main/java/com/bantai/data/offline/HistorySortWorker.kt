package com.bantai.data.offline

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.bantai.container
import com.bantai.data.SmsIngestPipeline
import com.bantai.data.model.Classification
import com.bantai.data.model.SmsMessage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext

private const val TAG = "HistorySortWorker"
private val UNVERIFIED = Classification.UNVERIFIED

/**
 * First-run sorting of the existing inbox with the on-device model (tester
 * feedback, 2026-10-14). Before this, the inbox was sorted one message every
 * 700 ms through the cloud from inside the Messages screen: about 35 minutes
 * for 3,000 texts, stopped whenever the app closed, and the tabs reshuffled
 * the whole time with nothing telling the user.
 *
 * Now:
 *  1. The last [RECENT_WINDOW_DAYS] days go first, while the Setup screen
 *     shows progress. When they're done, `historySortedAt` is saved and the
 *     app opens. Those verdicts are final: nothing re-sorts them later.
 *  2. Older texts follow silently. They sit far down the list.
 *
 * Each distinct text runs the model once. OTPs, promos and scam blasts repeat
 * word for word once numbers and links are masked, so this cuts much of the work.
 * WorkManager keeps it going across app restarts; a rerun skips what's done.
 */
class HistorySortWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {
    @Suppress("TooGenericExceptionCaught") // a model failure opens the app rather than trapping the user on Setup
    override suspend fun doWork(): Result {
        val container = applicationContext.container
        // Before onboarding grants SMS access there's nothing to sort yet, and
        // marking it sorted here would skip Setup on a fresh install.
        if (!container.smsRepository.hasReadSmsPermission()) return Result.success()
        val prefs = container.userPreferences
        // A new SORT_GENERATION re-sorts the whole inbox once (this also
        // covers a fresh install); otherwise only never-checked texts.
        val resort = prefs.userData.first().sortGenerationDone < SORT_GENERATION
        if (resort) prefs.startSortGeneration(SORT_GENERATION)
        val since = prefs.userData.first().sortGenerationStartedAt
        val now = System.currentTimeMillis()
        val pending = withContext(Dispatchers.IO) { pendingMessages(resort, since) }
        val cutoff = now - RECENT_WINDOW_DAYS * DAY_MS
        val (recent, older) = pending.partition { it.timestamp >= cutoff }
        return try {
            sort(recent, PHASE_RECENT, resort)
            markSorted()
            sort(older, PHASE_OLDER, resort)
            if (resort && !isStopped) prefs.saveSortGenerationDone(SORT_GENERATION)
            // The bulk sort is done; new texts reload the model when they come.
            ModelCRuntime.release()
            Result.success()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            // No working local model (or it crashed): don't hold the app hostage.
            // The Messages screen's own scan still covers unsorted texts.
            Log.e(TAG, "History sort stopped", e)
            markSorted()
            Result.failure()
        }
    }

    /**
     * Texts to sort. A re-sort takes every incoming text except the user's
     * own reports and ones already sorted since this generation began (so a
     * restart picks up where it stopped). Otherwise only texts no model checked.
     */
    private suspend fun pendingMessages(
        resort: Boolean,
        since: Long,
    ): List<SmsMessage> {
        val container = applicationContext.container
        val store = container.classificationStore
        val stored = store.snapshot()
        val reported =
            container.alertStateStore.state
                .first()
                .reportedLocal.keys
        val needed: (SmsMessage) -> Boolean =
            if (resort) {
                val skip = store.idsWithSource("user_report") + reported + store.idsClassifiedSince(since)
                ({ it.id !in skip })
            } else {
                val recheck = store.idsWithSource("heuristic") + (store.legacySafeIds() - reported)
                ({ it.id in recheck || stored[it.id].let { label -> label == null || label == UNVERIFIED } })
            }
        return container.smsRepository
            .getInboxMessages()
            .filter { msg -> !msg.isOutgoing && msg.id > 0 && textOf(msg).isNotBlank() && needed(msg) }
            .sortedByDescending { it.timestamp }
    }

    private suspend fun sort(
        messages: List<SmsMessage>,
        phase: String,
        escalate: Boolean,
    ) {
        if (messages.isEmpty()) {
            setProgress(workDataOf(KEY_PHASE to phase, KEY_DONE to 0, KEY_TOTAL to 0))
            return
        }
        // Same text after masking -> same verdict, so one inference per group.
        val groups = messages.groupByTo(LinkedHashMap()) { ModelCPreprocessor.preprocess(textOf(it)) }
        var done = 0
        setProgress(workDataOf(KEY_PHASE to phase, KEY_DONE to 0, KEY_TOTAL to messages.size))
        for (group in groups.values) {
            if (isStopped) return
            val result = ModelCRuntime.classify(applicationContext, textOf(group.first()))
            for (msg in group) {
                SmsIngestPipeline.applyHistoricalOnDeviceResult(applicationContext, msg, result, escalate)
            }
            done += group.size
            setProgress(workDataOf(KEY_PHASE to phase, KEY_DONE to done, KEY_TOTAL to messages.size))
        }
    }

    private suspend fun markSorted() {
        val prefs = applicationContext.container.userPreferences
        if (prefs.historySortedAt.first() == 0L) prefs.saveHistorySortedAt(System.currentTimeMillis())
    }

    private fun textOf(message: SmsMessage): String = message.mms?.text ?: message.body

    companion object {
        const val UNIQUE_NAME = "history-sort"
        const val KEY_PHASE = "phase"
        const val KEY_DONE = "done"
        const val KEY_TOTAL = "total"
        const val PHASE_RECENT = "recent"
        const val PHASE_OLDER = "older"

        /**
         * Bump to re-sort every phone once on its next update (a new model or
         * routing rule). 1 = 1.6: scams to Alerts, Spam-to-Scam escalation.
         */
        const val SORT_GENERATION = 1

        /** The blocking window. Testers wanted to wait about a minute, not several. */
        const val RECENT_WINDOW_DAYS = 30L
        private const val DAY_MS = 24L * 60 * 60 * 1000

        /** Starts (or keeps) the sort. Safe to call on every app start. */
        fun enqueue(context: Context) {
            WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(
                UNIQUE_NAME,
                ExistingWorkPolicy.KEEP,
                OneTimeWorkRequestBuilder<HistorySortWorker>().build(),
            )
        }
    }
}
