package com.bantai.data

import com.bantai.data.model.Classification
import com.bantai.data.remote.SmsApi
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Regression coverage for the C1 fix: routeServerClassification is the pure
 * decision function `applyServerClassification` delegates to (see
 * SmsIngestPipeline.kt) -- before this fix, every Spam *and* Scam `ALERT`
 * result, including a confirmed-fraud or >=90%-confidence Scam, mapped to the
 * same low-priority "spam" classification and Spam notification channel.
 */
class SmsIngestPipelineRoutingTest {
    @Suppress("LongParameterList") // one parameter per IngestResult field under test
    private fun ingestResult(
        action: SmsApi.Action,
        label: String,
        score: Double,
        suppressed: Boolean = false,
        bucket: String? = null,
        source: String? = "model",
    ) = SmsApi.IngestResult(
        action = action,
        label = label,
        score = score,
        suppressed = suppressed,
        bucket = bucket,
        classificationSource = source,
    )

    @Test
    fun `a sender already suppressed server-side is silent and stays blocked`() {
        val route = routeServerClassification(ingestResult(SmsApi.Action.BLOCKED, "Blocked", 1.0, suppressed = true))
        assertEquals(ClassificationRoute(Classification.SCAM, AlertKind.SILENT), route)
    }

    @Test
    fun `a legacy BLOCKED action is treated as smishing`() {
        val route = routeServerClassification(ingestResult(SmsApi.Action.BLOCKED, "Scam", 0.97))
        assertEquals(ClassificationRoute(Classification.SCAM, AlertKind.SMISHING), route)
    }

    @Test
    fun `a high-confidence scam alert is treated as smishing, not spam`() {
        val route = routeServerClassification(ingestResult(SmsApi.Action.ALERT, "Scam", 0.95))
        assertEquals(ClassificationRoute(Classification.SCAM, AlertKind.SMISHING), route)
    }

    @Test
    fun `a scam alert exactly at the threshold is treated as smishing`() {
        val route = routeServerClassification(ingestResult(SmsApi.Action.ALERT, "Scam", 0.90))
        assertEquals(ClassificationRoute(Classification.SCAM, AlertKind.SMISHING), route)
    }

    @Test
    fun `a lower-confidence scam alert is treated as suspicious, not spam`() {
        val route = routeServerClassification(ingestResult(SmsApi.Action.ALERT, "Scam", 0.6))
        assertEquals(ClassificationRoute(Classification.UNKNOWN, AlertKind.SUSPICIOUS), route)
    }

    @Test
    fun `a non-scam alert (confirmed-fraud sender) goes to review, not spam`() {
        // Spam no longer creates an Alert; a Spam/Ham ALERT means the sender is
        // confirmed fraud, which must reach the user even with spam notifications off.
        for (label in listOf("Spam", "Ham")) {
            val route = routeServerClassification(ingestResult(SmsApi.Action.ALERT, label, 0.7))
            assertEquals(ClassificationRoute(Classification.UNKNOWN, AlertKind.SUSPICIOUS), route)
        }
    }

    @Test
    fun `an inbox action is treated as a safe message`() {
        val route = routeServerClassification(ingestResult(SmsApi.Action.INBOX, "Ham", 0.99, bucket = "safe"))
        assertEquals(ClassificationRoute(Classification.SAFE, AlertKind.MESSAGE), route)
    }

    @Test
    fun `model spam without an alert goes to the spam chip`() {
        val route = routeServerClassification(ingestResult(SmsApi.Action.INBOX, "Spam", 0.99, bucket = "spam"))
        assertEquals(ClassificationRoute(Classification.SPAM, AlertKind.SPAM), route)
    }

    @Test
    fun `an uncertain scam without an alert goes to review, not safe`() {
        val route = routeServerClassification(ingestResult(SmsApi.Action.INBOX, "Scam", 0.62, bucket = "unknown"))
        assertEquals(ClassificationRoute(Classification.UNKNOWN, AlertKind.SUSPICIOUS), route)
    }

    @Test
    fun `a device-fallback echo mirrors the offline heuristic`() {
        val flagged =
            routeServerClassification(
                ingestResult(SmsApi.Action.INBOX, "Spam", 0.0, bucket = "unknown", source = "device_fallback"),
            )
        val clean =
            routeServerClassification(
                ingestResult(SmsApi.Action.INBOX, "Ham", 0.0, bucket = "unknown", source = "device_fallback"),
            )
        assertEquals(ClassificationRoute(Classification.UNKNOWN, AlertKind.SUSPICIOUS), flagged)
        assertEquals(ClassificationRoute(Classification.UNVERIFIED, AlertKind.MESSAGE), clean)
    }
}
