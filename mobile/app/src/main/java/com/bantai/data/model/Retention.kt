package com.bantai.data.model

import com.bantai.data.local.DeletedEntry

/**
 * How long BantAI keeps data before cleaning it up (tester feedback,
 * 2026-10-14). These match common messaging-app defaults and are shown to the
 * user wherever the data appears, so nothing disappears unannounced.
 */
object Retention {
    /** Recently Deleted is emptied after this, like the iOS / Google Messages trash. */
    const val RECENTLY_DELETED_DAYS = 30

    /** Texts from blocked senders are deleted after this. */
    const val BLOCKED_MESSAGES_DAYS = 30

    /** Scam Waves only show scams from this window. */
    const val SCAM_WAVE_DAYS = 90

    private const val DAY_MS = 24L * 60 * 60 * 1000

    fun cutoff(
        days: Int,
        now: Long,
    ): Long = now - days * DAY_MS

    /** Ids in Recently Deleted for longer than [RECENTLY_DELETED_DAYS]. */
    fun expiredDeletedIds(
        entries: List<DeletedEntry>,
        now: Long,
    ): Set<Long> {
        val cutoff = cutoff(RECENTLY_DELETED_DAYS, now)
        return entries.filter { it.deletedAt < cutoff }.mapTo(HashSet()) { it.id }
    }
}
