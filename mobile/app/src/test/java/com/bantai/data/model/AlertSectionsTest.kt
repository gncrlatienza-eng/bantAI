package com.bantai.data.model

import com.bantai.data.remote.SmsApi
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneOffset

class AlertSectionsTest {
    private val today = LocalDate.of(2026, 9, 29)

    private fun alert(
        id: String,
        date: String,
        bucket: String? = "blocked",
        sender: String = "+639171234567",
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
        bucket = bucket,
        clusterId = null,
    )

    private fun sections(
        alerts: List<SmsApi.AlertSummary>,
        filter: AlertFilter = AlertFilter.ALL,
        reviewed: Set<String> = emptySet(),
    ) = sectionAlerts(alerts, filter, reviewed, today, ZoneOffset.UTC)
        .map { it.title to it.alerts.map { a -> a.messageId } }

    @Test
    fun `a scam verdict is blocked, but not from a trusted sender`() {
        assertEquals(AlertKind.BLOCKED, alert("1", "2026-09-29").kind())
        assertEquals(AlertKind.NEEDS_REVIEW, alert("2", "2026-09-29", sender = "GCash").kind())
        assertEquals(AlertKind.NEEDS_REVIEW, alert("3", "2026-09-29", bucket = "unknown").kind())
    }

    @Test
    fun `alerts view never shows blocked scams, blocked view shows only those`() {
        val alerts =
            listOf(
                alert("review", "2026-09-29", bucket = "unknown"),
                alert("today", "2026-09-29"),
                alert("week", "2026-09-25"),
                alert("old", "2026-08-01"),
            )
        assertEquals(listOf("Needs Review" to listOf("review")), sections(alerts))
        assertEquals(
            listOf(
                "Today" to listOf("today"),
                "This Week" to listOf("week"),
                "Earlier" to listOf("old"),
            ),
            sections(alerts, AlertFilter.BLOCKED),
        )
    }

    @Test
    fun `a reviewed alert moves into the history`() {
        val alerts = listOf(alert("review", "2026-09-29", bucket = "unknown"))
        assertEquals(listOf("Today" to listOf("review")), sections(alerts, reviewed = setOf("review")))
    }

    @Test
    fun `each section is newest first whatever order the backend sent`() {
        val alerts =
            listOf(
                alert("mar", "2026-03-01", bucket = "unknown"),
                alert("jul", "2026-07-25", bucket = "unknown"),
                alert("may", "2026-05-12", bucket = "unknown"),
            )
        assertEquals(listOf("Needs Review" to listOf("jul", "may", "mar")), sections(alerts))
    }

    @Test
    fun `the blocked filter shows only blocked scams`() {
        val alerts = listOf(alert("scam", "2026-09-29"), alert("sus", "2026-09-29", bucket = "unknown"))
        assertEquals(listOf("Today" to listOf("scam")), sections(alerts, AlertFilter.BLOCKED))
    }
}
