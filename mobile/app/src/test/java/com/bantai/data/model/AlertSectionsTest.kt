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
        senderBlocked: Boolean = true,
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
        senderBlocked = senderBlocked,
    )

    private fun sections(
        alerts: List<SmsApi.AlertSummary>,
        tab: AlertTab = AlertTab.TO_REVIEW,
    ) = sectionAlerts(alerts, tab, today, ZoneOffset.UTC)
        .map { it.title to it.alerts.map { a -> a.messageId } }

    private val report = SmsApi.AlertReport(reportedLabel = "Spam", status = "Pending")

    @Test
    fun `a scam verdict is blocked, but not from a trusted sender`() {
        assertEquals(AlertKind.BLOCKED, alert("1", "2026-09-29").kind())
        assertEquals(AlertKind.NEEDS_REVIEW, alert("2", "2026-09-29", sender = "GCash").kind())
        assertEquals(AlertKind.NEEDS_REVIEW, alert("3", "2026-09-29", bucket = "unknown").kind())
    }

    @Test
    fun `a scam whose sender isn't actually blocked still needs review`() {
        assertEquals(AlertKind.NEEDS_REVIEW, alert("1", "2026-09-29", senderBlocked = false).kind())
    }

    @Test
    fun `every alert is on exactly one page, and a report wins over the rest`() {
        val alerts =
            listOf(
                alert("review", "2026-09-29", bucket = "unknown"),
                alert("blocked", "2026-09-29"),
                alert("reported-blocked", "2026-09-29").copy(report = report),
                alert("reported-review", "2026-09-29", bucket = "unknown").copy(report = report),
            )
        assertEquals(
            mapOf(
                "review" to AlertTab.TO_REVIEW,
                "blocked" to AlertTab.BLOCKED,
                "reported-blocked" to AlertTab.REPORTED,
                "reported-review" to AlertTab.REPORTED,
            ),
            alerts.associate { it.messageId to it.tab() },
        )
    }

    @Test
    fun `a page is grouped by age, newest first whatever order the backend sent`() {
        val alerts =
            listOf(
                alert("old", "2026-08-01"),
                alert("today", "2026-09-29"),
                alert("week", "2026-09-25"),
                alert("week2", "2026-09-27"),
            )
        assertEquals(
            listOf(
                "Today" to listOf("today"),
                "This Week" to listOf("week2", "week"),
                "Earlier" to listOf("old"),
            ),
            sections(alerts, AlertTab.BLOCKED),
        )
        assertEquals(emptyList<Pair<String, List<String>>>(), sections(alerts, AlertTab.TO_REVIEW))
    }

    @Test
    fun `reporting is what moves an alert out of To review`() {
        val alert = alert("review", "2026-09-29", bucket = "unknown")
        assertEquals(listOf("Today" to listOf("review")), sections(listOf(alert)))
        val reported = alert.copy(report = SmsApi.AlertReport(reportedLabel = "Scam", status = REPORT_PENDING))
        assertEquals(emptyList<Pair<String, List<String>>>(), sections(listOf(reported)))
        assertEquals(listOf("Today" to listOf("review")), sections(listOf(reported), AlertTab.REPORTED))
    }

    @Test
    fun `a report filed on this phone counts until the backend has it`() {
        val alerts = listOf(alert("1", "2026-09-29"), alert("2", "2026-09-29").copy(report = report))
        val merged = withLocalReports(alerts, mapOf("1" to "Ham", "2" to "Scam"))
        assertEquals(SmsApi.AlertReport("Ham", REPORT_PENDING), merged[0].report)
        // The backend's own record (with its real status) is kept.
        assertEquals(report, merged[1].report)
    }

    @Test
    fun `nothing is new before the seen store's first load`() {
        val alerts = listOf(alert("1", "2026-09-29"))
        assertEquals(emptyList<SmsApi.AlertSummary>(), unseenAlerts(alerts, initialized = false, seen = emptySet()))
        assertEquals(alerts, unseenAlerts(alerts, initialized = true, seen = emptySet()))
        assertEquals(emptyList<SmsApi.AlertSummary>(), unseenAlerts(alerts, initialized = true, seen = setOf("1")))
    }

    @Test
    fun `a report on a text with no alert still lands on Reported`() {
        val safeReport = alert("safe", "2026-09-29", bucket = "safe").copy(report = report, localId = 7)
        val merged = withReportList(listOf(alert("blocked", "2026-09-29")), listOf(safeReport))
        assertEquals(listOf("blocked", "safe"), merged.map { it.messageId })
        assertEquals(AlertTab.REPORTED, merged.last().tab())
    }

    @Test
    fun `a reported alert takes the report's group and isn't listed twice`() {
        val alerted = alert("1", "2026-09-29")
        val reported = alerted.copy(report = report, groupId = "g1")
        val merged = withReportList(listOf(alerted), listOf(reported))
        assertEquals(1, merged.size)
        assertEquals("g1", merged.single().groupId)
        assertEquals(report, merged.single().report)
    }

    @Test
    fun `a second backend copy of the same text on the phone isn't listed twice`() {
        val alerted = alert("copy-a", "2026-09-29").copy(localId = 42)
        val reportedCopy = alert("copy-b", "2026-09-29").copy(localId = 42, report = report)
        assertEquals(listOf("copy-a"), withReportList(listOf(alerted), listOf(reportedCopy)).map { it.messageId })
    }

    @Test
    fun `messages reported together are one entry, a lone report its own`() {
        val reports =
            listOf(
                alert("1", "2026-09-29").copy(groupId = "g"),
                alert("2", "2026-09-29"),
                alert("3", "2026-09-28").copy(groupId = "g"),
            )
        assertEquals(listOf(listOf("1", "3"), listOf("2")), groupReports(reports).map { g -> g.map { it.messageId } })
    }
}
