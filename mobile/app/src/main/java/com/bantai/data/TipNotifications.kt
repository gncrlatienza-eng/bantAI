package com.bantai.data

import com.bantai.data.remote.TipsApi
import java.time.Instant

/**
 * Which newly published safety tips this phone should be notified about.
 * Pure Kotlin (covered by TipNotificationsTest); TipCheckWorker does the I/O.
 *
 *  - A general tip (no campaign) notifies everyone.
 *  - A campaign tip notifies only a phone that has a matching Scam Wave, and
 *    opens that wave. Without one it waits, so a phone that gets that scam
 *    later is still told; after [LATE_MATCH_WINDOW_MS] it stops waiting.
 *  - The first check on a phone only notifies tips from the last
 *    [FIRST_RUN_WINDOW_MS]; older ones are marked seen quietly, so a new
 *    install isn't flooded with every tip ever published.
 */
object TipNotifications {
    /** One of this phone's Scam Waves: its route key and every name a tip may use for it. */
    data class WaveRef(
        val key: String,
        val names: List<String>,
    )

    data class Alert(
        val tip: TipsApi.PublishedTip,
        /** The wave to open, for a campaign tip; null opens Scam Awareness. */
        val waveKey: String?,
    )

    data class Plan(
        val alerts: List<Alert>,
        val markSeen: Set<String>,
    )

    fun plan(
        tips: List<TipsApi.PublishedTip>,
        seen: Set<String>,
        baselined: Boolean,
        waves: List<WaveRef>,
        now: Long,
    ): Plan {
        val alerts = mutableListOf<Alert>()
        val markSeen = mutableSetOf<String>()
        for (tip in tips.filter { it.id !in seen }) {
            val age = now - (parseInstant(tip.updatedAt) ?: now)
            val wave = if (tip.campaign == null) null else waves.firstOrNull { it.matches(tip) }
            when {
                // First check on this phone: older tips count as seen, quietly.
                !baselined && age > FIRST_RUN_WINDOW_MS -> markSeen += tip.id
                tip.campaign == null || wave != null -> {
                    alerts += Alert(tip, wave?.key)
                    markSeen += tip.id
                }
                age > LATE_MATCH_WINDOW_MS -> markSeen += tip.id
                // else: a campaign tip not relevant to this phone yet; check again next time.
            }
        }
        // A burst of publishing shows a few, newest first; the rest count as seen.
        return Plan(alerts.take(MAX_PER_CHECK), markSeen)
    }

    private fun WaveRef.matches(tip: TipsApi.PublishedTip): Boolean {
        val matched = PublishedTips.forWave(listOf(tip), names)
        return matched.isNotEmpty()
    }

    private fun parseInstant(value: String): Long? = runCatching { Instant.parse(value).toEpochMilli() }.getOrNull()

    const val FIRST_RUN_WINDOW_MS = 24 * 60 * 60 * 1000L
    const val LATE_MATCH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000L
    const val MAX_PER_CHECK = 3
}
