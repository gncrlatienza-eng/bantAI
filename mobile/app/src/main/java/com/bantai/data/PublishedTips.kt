package com.bantai.data

import com.bantai.data.remote.TipsApi
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * The team's published safety tips, shared by Scam Awareness and the Scam
 * Wave screen. Kept in memory for a few minutes so opening several waves
 * doesn't refetch; a failed fetch keeps the last good list (or none), and the
 * app's built-in tips still show either way.
 */
object PublishedTips {
    private val mutex = Mutex()
    private var cached: List<TipsApi.PublishedTip>? = null
    private var fetchedAt = 0L

    suspend fun load(now: Long = System.currentTimeMillis()): List<TipsApi.PublishedTip> =
        mutex.withLock {
            cached?.takeIf { now - fetchedAt < CACHE_MS }?.let { return it }
            TipsApi.listPublished().onSuccess {
                cached = it
                fetchedAt = now
            }
            cached.orEmpty()
        }

    /** A fresh fetch for the background check; null when the server can't be reached. */
    suspend fun refresh(now: Long = System.currentTimeMillis()): List<TipsApi.PublishedTip>? =
        mutex.withLock {
            TipsApi.listPublished().getOrNull()?.also {
                cached = it
                fetchedAt = now
            }
        }

    /** Tips not tied to a campaign: shown to everyone under "Latest warnings". */
    fun general(tips: List<TipsApi.PublishedTip>): List<TipsApi.PublishedTip> = tips.filter { it.campaign == null }

    /**
     * Tips whose campaign names this wave. The admin types the campaign as
     * free text, so any of the wave's names counts -- its id, raw category
     * ("Bank phishing"), friendly category ("Fake bank texts") or title --
     * ignoring case and surrounding spaces.
     */
    fun forWave(
        tips: List<TipsApi.PublishedTip>,
        waveNames: List<String>,
    ): List<TipsApi.PublishedTip> {
        val names = waveNames.map { it.trim().lowercase() }.filter { it.isNotEmpty() }.toSet()
        return tips.filter { tip -> tip.campaign?.trim()?.lowercase() in names }
    }

    private const val CACHE_MS = 5 * 60 * 1000L
}
