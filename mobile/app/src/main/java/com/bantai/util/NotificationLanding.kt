package com.bantai.util

import kotlinx.coroutines.flow.MutableStateFlow

/**
 * Where a tapped notification should land beyond its tab: the Spam chip, the
 * Reported page, or Blocked numbers. Set by MainActivity from a trusted
 * notification intent and cleared by whichever screen acts on it, so a tap
 * shows what the notification talked about instead of the tab's default page.
 */
object NotificationLanding {
    const val SPAM = "spam"
    const val REPORTS = "reports"
    const val BLOCKED = "blocked"

    val pending = MutableStateFlow<String?>(null)

    /** Takes [target] if it's the pending landing, so it's acted on once. */
    fun consume(target: String): Boolean = pending.compareAndSet(target, null)
}
