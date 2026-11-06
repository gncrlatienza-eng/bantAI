package com.bantai.data.model

import com.bantai.data.remote.SmsApi
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class AlertExpiryTest {
    private val now = Instant.parse("2026-10-14T12:00:00Z").toEpochMilli()

    private fun alert(
        date: String,
        bucket: String? = "blocked",
        senderBlocked: Boolean = true,
        report: SmsApi.AlertReport? = null,
    ) = SmsApi.AlertSummary(
        id = "a-$date",
        status = "Pending",
        createdAt = "${date}T08:00:00Z",
        messageId = "m-$date-$bucket-$senderBlocked-${report?.status}",
        sourceId = null,
        sender = "+639171234567",
        body = "body",
        receivedAt = "${date}T08:00:00Z",
        label = null,
        score = null,
        bucket = bucket,
        clusterId = null,
        senderBlocked = senderBlocked,
        report = report,
    )

    @Test
    fun `blocked alerts expire after 30 days`() {
        assertTrue(alert("2026-09-01").isExpired(now))
        assertFalse(alert("2026-10-01").isExpired(now))
    }

    @Test
    fun `to review never expires`() {
        assertFalse(alert("2026-01-01", senderBlocked = false).isExpired(now))
    }

    @Test
    fun `reviewed reports expire from their review date, pending ones never`() {
        val oldReview = SmsApi.AlertReport("Scam", REPORT_VALIDATED, reviewedAt = "2026-09-01T00:00:00Z")
        val recentReview = SmsApi.AlertReport("Scam", REPORT_REJECTED, reviewedAt = "2026-10-10T00:00:00Z")
        val pending = SmsApi.AlertReport("Scam", REPORT_PENDING)
        assertTrue(alert("2026-08-01", report = oldReview).isExpired(now))
        assertFalse(alert("2026-08-01", report = recentReview).isExpired(now))
        assertFalse(alert("2026-01-01", report = pending).isExpired(now))
    }

    @Test
    fun `hide unknown drops unknown verdicts but keeps scams`() {
        val unknown = alert("2026-10-13", bucket = "unknown", senderBlocked = false)
        val scam = alert("2026-10-13", senderBlocked = false)
        assertEquals(listOf(scam), visibleAlerts(listOf(unknown, scam), hideUnknown = true, nowMillis = now))
        assertEquals(2, visibleAlerts(listOf(unknown, scam), hideUnknown = false, nowMillis = now).size)
    }

    @Test
    fun `blocked senders are left out of Alerts`() {
        val blocked = alert("2026-10-13")
        val review = alert("2026-10-13", senderBlocked = false)
        assertEquals(listOf(review), visibleAlerts(listOf(blocked, review), hideUnknown = false, nowMillis = now))
    }
}
