package com.bantai.data

import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.provider.Telephony
import android.util.Log
import com.bantai.data.local.ClassificationStore
import com.bantai.data.local.UserPreferences
import com.bantai.data.remote.ApiConfig
import com.bantai.data.remote.SmsApi
import com.bantai.util.BlockHelper
import com.bantai.util.NotificationHelper
import kotlinx.coroutines.flow.first

private const val TAG = "SmsIngestPipeline"

/**
 * Shared entry point for turning a message (real, over-the-air SMS or a
 * synthetic one from the debug "Simulate incoming SMS" tool) into an inbox
 * row, a classification, and a notification. [SmsReceiver] and the debug
 * tool both funnel through this so the two paths can never disagree on
 * behavior.
 */
object SmsIngestPipeline {

    /**
     * Convenience entry point for the debug "Simulate incoming SMS" tool. Unlike
     * SmsReceiver's real broadcast path, this has no goAsync() deadline, so it
     * uses a longer timeout (SIMULATE_TIMEOUT_MS) that can actually wait out a
     * slow classification instead of racing it and silently falling back to the
     * local heuristic before the backend (and any real Alert row) responds.
     */
    suspend fun ingest(context: Context, sender: String, body: String, receivedAt: Long, sentAt: Long) {
        val repository = SmsRepository(context)
        val isDefaultSmsApp = Telephony.Sms.getDefaultSmsPackage(context) == context.packageName
        val messageId = if (isDefaultSmsApp) storeMessage(context, sender, body, receivedAt, sentAt) else null
        val token = runCatching {
            UserPreferences(context).userData.first().authToken
        }.getOrDefault("")
        classifyAndNotify(
            context, repository, token, sender, body, receivedAt, messageId,
            timeoutMs = ApiConfig.SIMULATE_TIMEOUT_MS,
        )
    }

    fun storeMessage(
        context: Context,
        sender: String,
        body: String,
        receivedAt: Long,
        sentAt: Long,
    ): Long? {
        val values = ContentValues().apply {
            put(Telephony.Sms.ADDRESS, sender)
            put(Telephony.Sms.BODY, body)
            put(Telephony.Sms.DATE, receivedAt)
            put(Telephony.Sms.DATE_SENT, sentAt)
            put(Telephony.Sms.READ, 0)
            put(Telephony.Sms.SEEN, 0)
            put(Telephony.Sms.STATUS, Telephony.Sms.STATUS_NONE)
            put(Telephony.Sms.TYPE, Telephony.Sms.MESSAGE_TYPE_INBOX)
        }
        return try {
            val uri = context.contentResolver.insert(Telephony.Sms.Inbox.CONTENT_URI, values)
            uri?.let { ContentUris.parseId(it) }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to insert message from $sender", e)
            null
        }
    }

    /**
     * Classifies via the backend (which runs the fine-tuned model) and falls back
     * to the on-device heuristic whenever that is not possible — no stored token,
     * timeout, server error, or no connectivity. The fallback is deliberately
     * silent from the user's perspective: they still get the same alerts.
     */
    suspend fun classifyAndNotify(
        context: Context,
        repository: SmsRepository,
        token: String,
        sender: String,
        body: String,
        receivedAt: Long,
        messageId: Long?,
        timeoutMs: Int = ApiConfig.SMS_TIMEOUT_MS,
    ) {
        // Notification ID: XOR of sender hash and truncated timestamp avoids
        // the collision caused by System.currentTimeMillis().toInt() overflow.
        val notifId = (sender.hashCode() xor (System.currentTimeMillis() ushr 10).toInt()) and Int.MAX_VALUE

        val result = if (token.isEmpty()) {
            Log.w(TAG, "No auth token stored — classifying $sender locally")
            null
        } else {
            SmsApi.ingest(token, sender, body, receivedAt, timeoutMs)
                .onFailure { Log.w(TAG, "Backend ingest failed for $sender — classifying locally", it) }
                .getOrNull()
        }

        if (result != null) {
            applyBackendAction(context, result, sender, body, notifId, messageId)
        } else {
            applyLocalClassification(context, repository, sender, body, notifId, messageId)
        }
    }

    // Without this, the UI would re-derive a classification from the local keyword
    // heuristic on every read — including for messages the real backend model
    // already classified — so what's displayed could silently disagree with the
    // decision that actually drove blocking/notifications for this message.
    private suspend fun persistClassification(context: Context, messageId: Long?, classification: String) {
        if (messageId == null) return
        try {
            ClassificationStore(context).setClassification(messageId, classification)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to persist classification for $messageId", e)
        }
    }

    private suspend fun applyBackendAction(
        context: Context,
        result: SmsApi.IngestResult,
        sender: String,
        body: String,
        notifId: Int,
        messageId: Long?,
    ) {
        // Sender was already blocked, so the backend did no work and the user has
        // already chosen not to hear from them.
        if (result.suppressed) return

        when (result.action) {
            SmsApi.Action.BLOCKED -> {
                persistClassification(context, messageId, "suspicious")
                BlockHelper.blockNumberSystem(context, sender)
                NotificationHelper.sendSmishingAlert(context, sender, notifId)
            }
            SmsApi.Action.ALERT -> {
                persistClassification(context, messageId, "unknown")
                NotificationHelper.sendSuspiciousAlert(context, sender, notifId)
            }
            // A normal, non-threatening message — BantAI is standing in for the
            // user's regular texting app, so this still needs an ordinary notification.
            SmsApi.Action.INBOX -> {
                persistClassification(context, messageId, "safe")
                NotificationHelper.sendMessageNotification(context, sender, body, notifId)
            }
        }
    }

    private suspend fun applyLocalClassification(
        context: Context,
        repository: SmsRepository,
        sender: String,
        body: String,
        notifId: Int,
        messageId: Long?,
    ) {
        val classification = repository.classifyMessagePublic(sender, body)
        persistClassification(context, messageId, classification)
        when (classification) {
            "suspicious" -> {
                BlockHelper.blockNumberSystem(context, sender)
                NotificationHelper.sendSmishingAlert(context, sender, notifId)
            }
            "unknown" -> {
                NotificationHelper.sendSuspiciousAlert(context, sender, notifId)
            }
            // "safe" — still a normal incoming message, still needs a notification
            else -> NotificationHelper.sendMessageNotification(context, sender, body, notifId)
        }
    }
}
