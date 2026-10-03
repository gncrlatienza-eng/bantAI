package com.bantai.data.model

import com.bantai.data.remote.SmsApi
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneOffset

class ReportSectionsTest {
    private val today = LocalDate.of(2026, 9, 29)

    private fun reported(
        id: String,
        date: String,
        status: String = REPORT_PENDING,
        sender: String = "+639171234567",
        groupId: String? = null,
    ) = SmsApi.AlertSummary(
        id = "a-$id",
        status = "Pending",
        createdAt = "${date}T08:00:00Z",
        messageId = id,
        sourceId = null,
        sender = sender,
        body = "body",
        receivedAt = "${date}T08:00:00Z",
        label = null,
        score = null,
        bucket = "suspicious",
        clusterId = null,
        report = SmsApi.AlertReport(reportedLabel = "Spam", status = status),
        groupId = groupId,
    )

    private fun rows(
        alerts: List<SmsApi.AlertSummary>,
        filter: ReportFilter,
    ) = reportSections(alerts, filter, today, ZoneOffset.UTC)
        .map { section -> section.title to section.rows.map { row -> row.reports.map { it.map { a -> a.messageId } } } }

    @Test
    fun `each filter shows only its own review outcome`() {
        val alerts =
            listOf(
                reported("1", "2026-09-29", REPORT_PENDING, sender = "A"),
                reported("2", "2026-09-29", REPORT_VALIDATED, sender = "B"),
                reported("3", "2026-09-29", REPORT_REJECTED, sender = "C"),
            )
        assertEquals(listOf("Today" to listOf(listOf(listOf("1")))), rows(alerts, ReportFilter.WAITING))
        assertEquals(listOf("Today" to listOf(listOf(listOf("2")))), rows(alerts, ReportFilter.ACCEPTED))
        assertEquals(listOf("Today" to listOf(listOf(listOf("3")))), rows(alerts, ReportFilter.NOT_ACCEPTED))
    }

    @Test
    fun `one sender's reports share a row, newest first, under the newest report's date`() {
        val alerts =
            listOf(
                reported("old", "2026-08-01"),
                reported("new", "2026-09-29"),
                reported("other", "2026-09-28", sender = "BPI"),
            )
        assertEquals(
            listOf(
                "Today" to listOf(listOf(listOf("new"), listOf("old"))),
                "This Week" to listOf(listOf(listOf("other"))),
            ),
            rows(alerts, ReportFilter.WAITING),
        )
    }

    @Test
    fun `messages reported together stay one report inside the sender's row`() {
        val alerts =
            listOf(
                reported("1", "2026-09-29", groupId = "g"),
                reported("2", "2026-09-29", groupId = "g"),
                reported("3", "2026-09-20"),
            )
        assertEquals(
            listOf("Today" to listOf(listOf(listOf("1", "2"), listOf("3")))),
            rows(alerts, ReportFilter.WAITING),
        )
    }

    @Test
    fun `the same number written two ways is one sender`() {
        assertEquals(
            senderKey(reported("1", "2026-09-29", sender = "+639171234567")),
            senderKey(reported("2", "2026-09-29", sender = "09171234567")),
        )
    }

    @Test
    fun `a report with no sender on this phone is its own row`() {
        val alerts = listOf(reported("1", "2026-09-29", sender = ""), reported("2", "2026-09-29", sender = ""))
        assertEquals(2, reportSections(alerts, ReportFilter.WAITING, today, ZoneOffset.UTC).single().rows.size)
    }

    @Test
    fun `counts are reports, not messages`() {
        val alerts =
            listOf(
                reported("1", "2026-09-29", groupId = "g"),
                reported("2", "2026-09-29", groupId = "g"),
                reported("3", "2026-09-29", REPORT_VALIDATED),
            )
        assertEquals(mapOf(ReportFilter.WAITING to 1, ReportFilter.ACCEPTED to 1), reportCounts(alerts))
    }
}
