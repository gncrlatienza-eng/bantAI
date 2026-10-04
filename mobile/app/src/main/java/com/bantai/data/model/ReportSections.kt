package com.bantai.data.model

import com.bantai.data.remote.SmsApi
import java.time.LocalDate
import java.time.ZoneId

// How Alerts -> Reported groups and filters the user's reports. Kept apart
// from AlertSections.kt, which places alerts on their tabs.

/**
 * The Reported page's entries: messages reported together (same groupId) as
 * one entry, newest message first within it; a single report is an entry of
 * one. Entries keep the order of their newest message in [reported].
 */
fun groupReports(reported: List<SmsApi.AlertSummary>): List<List<SmsApi.AlertSummary>> =
    reported
        .groupBy(::reportKey)
        .values
        .toList()

/** One report's identity: its groupId when several messages were reported together, else the message. */
fun reportKey(alert: SmsApi.AlertSummary): String = alert.groupId ?: alert.messageId

/**
 * The Reported page's three filters, one per review outcome. Waiting is the
 * only one that still changes, so it's where the page opens.
 */
enum class ReportFilter { WAITING, ACCEPTED, NOT_ACCEPTED }

fun SmsApi.AlertReport.filter(): ReportFilter =
    when (status) {
        REPORT_VALIDATED -> ReportFilter.ACCEPTED
        REPORT_REJECTED -> ReportFilter.NOT_ACCEPTED
        else -> ReportFilter.WAITING
    }

/**
 * Who a report is about, for grouping several reports into one row: the
 * normalized sender, or the report itself when the sender isn't known on this
 * phone (a report filed from another device).
 */
fun senderKey(alert: SmsApi.AlertSummary): String {
    val sender = alert.sender
    return if (sender.isEmpty()) reportKey(alert) else normalizeSenderKey(sender)
}

/**
 * One Reported row: every report about one sender with the same outcome.
 * [reports] holds each report as its messages (several when they were
 * reported together), newest report first.
 */
data class SenderReports(
    val key: String,
    val reports: List<List<SmsApi.AlertSummary>>,
) {
    val latest: SmsApi.AlertSummary get() = reports.first().first()
}

data class ReportSection(
    val title: String,
    val rows: List<SenderReports>,
)

/**
 * The reports on [filter], as one row per sender, grouped Today / This Week /
 * Earlier by their newest report.
 */
fun reportSections(
    alerts: List<SmsApi.AlertSummary>,
    filter: ReportFilter,
    today: LocalDate = LocalDate.now(),
    zone: ZoneId = ZoneId.systemDefault(),
): List<ReportSection> {
    val rows =
        alerts
            .filter { it.report?.filter() == filter }
            .sortedByDescending { receivedMillis(it.receivedAt) }
            .groupBy(::senderKey)
            .map { (key, items) -> SenderReports(key, groupReports(items)) }
    val byAge = rows.groupBy { ageBucket(it.latest.receivedAt, today, zone) }
    return AGE_BUCKETS.mapNotNull { bucket -> byAge[bucket]?.let { ReportSection(bucket, it) } }
}

/** How many reports (not messages) each filter holds, for the filter's count. */
fun reportCounts(alerts: List<SmsApi.AlertSummary>): Map<ReportFilter, Int> =
    alerts
        .mapNotNull { alert -> alert.report?.let { it.filter() to reportKey(alert) } }
        .groupBy({ it.first }, { it.second })
        .mapValues { (_, keys) -> keys.distinct().size }
