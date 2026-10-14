package com.bantai.data

import android.content.Context
import android.util.Log
import com.bantai.BuildConfig
import com.bantai.container
import com.bantai.data.model.Classification
import com.bantai.data.model.SmsMessage
import com.bantai.data.model.normalizeSenderKey
import com.bantai.data.offline.ModelCRuntime
import com.bantai.util.SmsPrivacyMasker
import kotlinx.coroutines.CancellationException
import java.time.Instant
import java.util.Locale

private const val TAG = "ClassificationDiag"
private const val MODEL_C_CLASSES = 3
private const val PERCENT = 100

/**
 * "Copy diagnostic info": everything needed to tell whether a misfiled message
 * was the model's mistake or the app's routing. The AI team runs the masked
 * text through the server model and compares.
 *
 * The on-device model is re-run here because a cloud verdict overwrites the
 * stored on-device one, so the stored row alone can't show where the local
 * model itself was wrong. Only masked text leaves this function -- the same
 * masking a cloud check uses -- and the user shares it themselves.
 */
object ClassificationDiagnostics {
    @Suppress("TooGenericExceptionCaught") // any local-model failure is reported in the text, not thrown
    suspend fun build(
        context: Context,
        message: SmsMessage,
    ): String {
        val container = context.container
        val provenance = container.classificationStore.provenanceFor(message.id)
        val stored = container.classificationStore.snapshotFor(message.id)
        val blocked = container.blockedSendersStore.current().blocked
        val senderBlocked = message.sender in blocked || normalizeSenderKey(message.sender) in blocked
        val body = message.mms?.text ?: message.body
        val onDevice =
            try {
                val result = ModelCRuntime.classify(context, body)
                val probs = result.probabilities
                val distribution =
                    if (probs.size == MODEL_C_CLASSES) {
                        "Ham ${pct(probs[0])} / Spam ${pct(probs[1])} / Scam ${pct(probs[2])}"
                    } else {
                        "n/a"
                    }
                "${result.decision.modelLabel} -> ${result.decision.classification.tab()} " +
                    "($distribution, model ${result.modelVersion})"
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.w(TAG, "On-device re-check failed for ${message.id}", e)
                "unavailable (${e.javaClass.simpleName})"
            }
        return buildString {
            appendLine("BantAI diagnostic info (app ${BuildConfig.VERSION_NAME})")
            appendLine("Received: ${Instant.ofEpochMilli(message.timestamp)}")
            appendLine("Sender: ${SmsPrivacyMasker.maskForRemoteClassification(message.sender)}")
            appendLine("Shown in: ${message.classification.tab()}${if (senderBlocked) " (sender blocked)" else ""}")
            appendLine("Stored label: ${stored?.storage ?: "none"}")
            appendLine("Source: ${provenance?.source ?: "none"}")
            appendLine("Score: ${provenance?.score?.let(::pct) ?: "n/a"}")
            appendLine("Model: ${provenance?.modelVersion ?: "n/a"}")
            appendLine("Checked at: ${provenance?.classifiedAt?.let { Instant.ofEpochMilli(it).toString() } ?: "n/a"}")
            appendLine("On-device re-check: $onDevice")
            appendLine("Masked text: ${SmsPrivacyMasker.maskForRemoteClassification(body)}")
        }.trimEnd()
    }

    private fun pct(value: Double): String = String.format(Locale.US, "%.1f%%", value * PERCENT)

    private fun Classification.tab(): String =
        when (this) {
            Classification.SAFE, Classification.UNVERIFIED -> "Messages ($storage)"
            Classification.SPAM -> "Spam"
            Classification.UNKNOWN -> "Review"
            Classification.SCAM -> "Alerts/Scam"
        }
}
