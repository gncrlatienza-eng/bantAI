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
     * Report keys to move, with where: a report that was *just* rejected and
     * whose reviewer said what the text really is ("Ham" -> Messages,
     * "Spam" -> Spam). Rejections without a label, and anything already seen,
     * stay where they are.
     */
    fun refiles(
        plan: Plan,
        reviewedLabels: Map<String, String?>,
    ): Map<String, String> =
        plan.notify
            .filter { (_, status) -> status == REPORT_REJECTED }
            .mapNotNull { (key, _) -> reviewedLabels[key]?.takeIf { it in REVIEWED_LABELS }?.let { key to it } }
            .toMap()

    private val REVIEWED_LABELS = setOf("Ham", "Spam")

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
