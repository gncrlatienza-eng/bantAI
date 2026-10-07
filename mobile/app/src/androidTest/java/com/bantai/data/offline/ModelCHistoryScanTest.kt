package com.bantai.data.offline

import android.app.NotificationManager
import android.net.ConnectivityManager
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.bantai.container
import com.bantai.data.SmsIngestPipeline
import com.bantai.data.model.Classification
import com.bantai.data.model.SmsMessage
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

/** Signed-out history scans use real local inference silently and retain provenance. */
@RunWith(AndroidJUnit4::class)
class ModelCHistoryScanTest {
    @Test
    fun signedOutHistoryScanUsesModelAndKeepsCloudPrecedenceWithoutNotifications() =
        runBlocking {
            val context = InstrumentationRegistry.getInstrumentation().targetContext
            assertNull(context.getSystemService(ConnectivityManager::class.java).activeNetwork)
            val fixtures =
                context.assets
                    .open("model_c/parity_fixtures.json")
                    .bufferedReader()
                    .use { JSONObject(it.readText()).getJSONArray("fixtures") }
            val scam =
                (0 until fixtures.length())
                    .map(fixtures::getJSONObject)
                    .first { it.getString("label") == "Scam" }
            val message =
                SmsMessage(
                    id = Long.MIN_VALUE + 50476,
                    sender = "+639170000001",
                    body = scam.getString("raw"),
                    timestamp = System.currentTimeMillis(),
                )
            val store = context.container.classificationStore
            val notifications = context.getSystemService(NotificationManager::class.java)
            val before = notifications.activeNotifications.map { it.key }.toSet()
            try {
                val outcome =
                    SmsIngestPipeline.classifyExisting(context, "", message) as
                        SmsIngestPipeline.ScanOutcome.Classified
                assertFalse("Offline inference is separate from campaign matching", outcome.matchedRemotely)
                assertEquals(Classification.UNKNOWN, outcome.classification)
                val actualModel = ModelCRuntime.classify(context, message.body)
                val provenance = store.provenanceFor(message.id)
                assertEquals("on_device_model_c", provenance?.source)
                assertEquals(actualModel.modelVersion, provenance?.modelVersion)
                assertEquals(actualModel.modelSha256, provenance?.modelSha256)
                assertEquals(actualModel.decision.score, requireNotNull(provenance?.score), 0.000001)
                assertEquals(
                    "Old SMS scans must not emit alerts",
                    before,
                    notifications.activeNotifications.map { it.key }.toSet(),
                )
                store.setClassification(message.id, Classification.SAFE, source = "cloud_model", score = 0.99)
                val later =
                    SmsIngestPipeline.classifyExisting(context, "", message) as
                        SmsIngestPipeline.ScanOutcome.Classified
                assertEquals(Classification.SAFE, later.classification)
                assertEquals("cloud_model", store.provenanceFor(message.id)?.source)
            } finally {
                store.remove(listOf(message.id))
            }
        }
}
