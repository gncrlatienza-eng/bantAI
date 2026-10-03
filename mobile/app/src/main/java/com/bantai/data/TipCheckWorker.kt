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
import com.bantai.data.model.Classification
import com.bantai.data.model.LocalScamMessage
import com.bantai.data.model.buildLocalCampaigns
import com.bantai.ui.screens.main.waveNames
import com.bantai.util.NotificationHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/**
 * Checks for newly published safety tips and notifies (TipNotifications
 * decides which). Runs about every 15 minutes -- Android's minimum for
 * background work -- and once whenever the app opens.
 */
class TipCheckWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val tips = PublishedTips.refresh() ?: return Result.retry()
        val prefs = applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val seen = prefs.getStringSet(KEY_SEEN, emptySet()).orEmpty()
        val baselined = prefs.getBoolean(KEY_BASELINED, false)
        val unseen = tips.filter { it.id !in seen }
        if (unseen.isEmpty() && baselined) return Result.success()

        // This phone's Scam Waves are only needed to place a campaign tip.
        val waves = if (unseen.any { it.campaign != null }) localWaves() else emptyList()
        val plan = TipNotifications.plan(tips, seen, baselined, waves, System.currentTimeMillis())
        plan.alerts.forEach { NotificationHelper.sendSafetyTip(applicationContext, it.tip, it.waveKey) }
        prefs
            .edit()
            // Only ids still published are kept, so the set doesn't grow forever.
            .putStringSet(KEY_SEEN, (seen + plan.markSeen).filterTo(mutableSetOf()) { id -> tips.any { it.id == id } })
            .putBoolean(KEY_BASELINED, true)
            .apply()
        return Result.success()
    }

    // Same grouping as the Scam Waves tab (CampaignsViewModel), from this
    // phone's own scam and suspicious texts.
    private suspend fun localWaves(): List<TipNotifications.WaveRef> {
        val container = applicationContext.container
        if (!container.smsRepository.hasReadSmsPermission()) return emptyList()
        val matches = container.campaignMatchStore.snapshot()
        val inbox = withContext(Dispatchers.IO) { container.smsRepository.getInboxMessages() }
        val messages =
            inbox
                .filter { !it.isOutgoing && it.classification in WAVE_CLASSIFICATIONS }
                .map { LocalScamMessage(it.id, it.sender, it.body, it.timestamp, matches[it.id], it.classification) }
        return buildLocalCampaigns(messages)
            .sections
            .flatMap { it.campaigns }
            .sortedByDescending { it.latestTimestamp }
            .map { TipNotifications.WaveRef(it.key, waveNames(it)) }
    }

    companion object {
        private const val PERIODIC_WORK = "safety-tips-periodic"
        private const val ON_OPEN_WORK = "safety-tips-on-open"
        private const val PREFS = "safety_tips"
        private const val KEY_SEEN = "notified_tip_ids"
        private const val KEY_BASELINED = "baselined"
        private const val INTERVAL_MINUTES = 15L
        private val WAVE_CLASSIFICATIONS = setOf(Classification.SCAM, Classification.UNKNOWN)

        private val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

        /** Keeps the periodic check scheduled and runs one now. Safe to call on every app start. */
        fun schedule(context: Context) {
            val workManager = WorkManager.getInstance(context)
            val periodic =
                PeriodicWorkRequestBuilder<TipCheckWorker>(INTERVAL_MINUTES, TimeUnit.MINUTES)
                    .setConstraints(online)
                    .build()
            workManager.enqueueUniquePeriodicWork(PERIODIC_WORK, ExistingPeriodicWorkPolicy.KEEP, periodic)
            workManager.enqueueUniqueWork(
                ON_OPEN_WORK,
                ExistingWorkPolicy.REPLACE,
                OneTimeWorkRequestBuilder<TipCheckWorker>().setConstraints(online).build(),
            )
        }
    }
}
