package com.bantai.data

import com.bantai.data.model.REPORT_REJECTED
import com.bantai.data.model.REPORT_VALIDATED

/**
 * Decides which of the user's reports deserve a "your report was reviewed"
 * notification. Pure Kotlin (covered by ReportStatusNotificationsTest);
 * ReportStatusWorker does the I/O.
 *
 * Testers asked to hear back after reporting, so a report doesn't feel like it
 * went nowhere. Only the outcome is news: Pending -> Validated/Rejected.
 */
object ReportStatusNotifications {
    data class Plan(
        /** Report keys whose new review outcome should be notified. */
        val notify: List<Pair<String, String>>,
        /** Status per report key to remember for the next check. */
        val remember: Map<String, String>,
    )

    /**
     * [previous] is null on the first check after install or update: that
     * check only records statuses, so reports reviewed long ago don't all
     * notify at once.
     */
    fun plan(
        previous: Map<String, String>?,
        current: Map<String, String>,
    ): Plan {
        if (previous == null) return Plan(emptyList(), current)
        val notify =
            current
                .filter { (key, status) -> status in REVIEWED && previous[key] != status }
                .map { it.key to it.value }
        return Plan(notify, current)
    }

    private val REVIEWED = setOf(REPORT_VALIDATED, REPORT_REJECTED)
}
