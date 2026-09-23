package com.bantai.data

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
    private fun ingestResult(
        action: SmsApi.Action,
        label: String,
        score: Double,
        suppressed: Boolean = false,
    ) = SmsApi.IngestResult(action = action, label = label, score = score, suppressed = suppressed)

    @Test
    fun `a sender already suppressed server-side is silent and stays blocked`() {
        val route = routeServerClassification(ingestResult(SmsApi.Action.BLOCKED, "Blocked", 1.0, suppressed = true))
        assertEquals(ClassificationRoute("blocked", AlertKind.SILENT), route)
    }

    @Test
    fun `a legacy BLOCKED action is treated as smishing`() {
        val route = routeServerClassification(ingestResult(SmsApi.Action.BLOCKED, "Scam", 0.97))
        assertEquals(ClassificationRoute("blocked", AlertKind.SMISHING), route)
    }

    @Test
    fun `a high-confidence scam alert is treated as smishing, not spam`() {
        val route = routeServerClassification(ingestResult(SmsApi.Action.ALERT, "Scam", 0.95))
        assertEquals(ClassificationRoute("blocked", AlertKind.SMISHING), route)
    }

    @Test
    fun `a scam alert exactly at the threshold is treated as smishing`() {
        val route = routeServerClassification(ingestResult(SmsApi.Action.ALERT, "Scam", 0.90))
        assertEquals(ClassificationRoute("blocked", AlertKind.SMISHING), route)
    }

    @Test
    fun `a lower-confidence scam alert is treated as suspicious, not spam`() {
        val route = routeServerClassification(ingestResult(SmsApi.Action.ALERT, "Scam", 0.6))
        assertEquals(ClassificationRoute("unknown", AlertKind.SUSPICIOUS), route)
    }

    @Test
    fun `a spam alert is treated as spam`() {
        val route = routeServerClassification(ingestResult(SmsApi.Action.ALERT, "Spam", 0.7))
        assertEquals(ClassificationRoute("spam", AlertKind.SPAM), route)
    }

    @Test
    fun `an inbox action is treated as a safe message`() {
        val route = routeServerClassification(ingestResult(SmsApi.Action.INBOX, "Ham", 0.99))
        assertEquals(ClassificationRoute("safe", AlertKind.MESSAGE), route)
    }
}
