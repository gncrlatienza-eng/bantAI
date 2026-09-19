package com.bantai.data

import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.provider.Telephony
import android.util.Log
import com.bantai.BuildConfig
import com.bantai.data.local.ClassificationStore
import com.bantai.data.local.UserPreferences
import com.bantai.data.remote.ApiConfig
import com.bantai.data.remote.SmsApi
import com.bantai.util.NotificationHelper
import com.bantai.util.SmsPrivacyMasker
import kotlinx.coroutines.flow.first

private const val TAG = "SmsIngestPipeline"

/**
 * Shared entry point for turning a message (real, over-the-air SMS or a
 * synthetic one from the debug "Simulate incoming SMS" tool) into an inbox
 * row, a privacy-masked server classification when available, and a
 * notification. Raw SMS content never leaves the device; only locally masked
 * text is sent to the classifier.
 */
object SmsIngestPipeline {
    /**
     * Convenience entry point for the debug "Simulate incoming SMS" tool. Unlike
     * SmsReceiver's real broadcast path, this has no goAsync() deadline, so it
     * uses a longer timeout (SIMULATE_TIMEOUT_MS) that can actually wait out a
     * slow classification instead of racing it and silently falling back to the
     * local heuristic before the backend (and any real Alert row) responds.
     */
    suspend fun ingest(
        context: Context,
        sender: String,
        body: String,
        receivedAt: Long,
        sentAt: Long,
    ) {
        val repository = SmsRepository(context)
        val isDefaultSmsApp = Telephony.Sms.getDefaultSmsPackage(context) == context.packageName
        val messageId = if (isDefaultSmsApp) storeMessage(context, sender, body, receivedAt, sentAt) else null
        val token =
            runCatching {
                UserPreferences(context).userData.first().authToken
            }.getOrDefault("")
        classifyAndNotify(
            context,
            repository,
            token,
            sender,
            body,
            receivedAt,
            messageId,
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
        val values =
            ContentValues().apply {
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
            if (BuildConfig.DEBUG) Log.e(TAG, "Failed to insert message from $sender", e)
            null
        }
    }

    /**
     * Requests the deployed model using locally masked text. Offline keyword
     * rules can show a caution, but cannot block a sender. High-risk model and
     * fraud results open an alert so the user can choose Block, Report, or
     * Ignore explicitly.
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

        if (token.isNotEmpty()) {
            val fallback = repository.classifyMessagePublic(sender, body)
            val (label, score, bucket) = classificationMetadata(fallback)
            val sourceId = messageId?.toString() ?: "${sender.hashCode()}:$receivedAt"
            SmsApi
                .ingest(
                    token = token,
                    sender = sender,
                    receivedAtMillis = receivedAt,
                    sourceId = sourceId,
                    maskedBody = SmsPrivacyMasker.maskForRemoteClassification(body),
                    label = label,
                    score = score,
                    bucket = bucket,
                    domains = extractDomains(body),
                    timeoutMs = timeoutMs,
                ).onSuccess { result ->
                    applyServerClassification(context, sender, body, notifId, messageId, result)
                }.onFailure {
                    Log.w(TAG, "Model classification unavailable; showing local caution only", it)
                    applyOfflineCaution(context, repository, sender, body, notifId, messageId)
                }
        } else {
            applyOfflineCaution(context, repository, sender, body, notifId, messageId)
        }
    }

    // Persist the result that actually drove the local protection decision.
    private suspend fun persistClassification(
        context: Context,
        messageId: Long?,
        classification: String,
    ) {
        if (messageId == null) return
        try {
            ClassificationStore(context).setClassification(messageId, classification)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to persist classification for $messageId", e)
        }
    }

    private fun classificationMetadata(classification: String): Triple<String, Double, String> =
        when (classification) {
            "suspicious" -> Triple("Scam", 0.0, "unknown")
            "unknown" -> Triple("Spam", 0.0, "unknown")
            else -> Triple("Ham", 0.0, "unknown")
        }

    private fun extractDomains(body: String): List<String> =
        Regex("https?://([^/\\s?#]+)", RegexOption.IGNORE_CASE)
            .findAll(body)
            .map { it.groupValues[1].lowercase().removePrefix("www.") }
            .distinct()
            .take(20)
            .toList()

    private suspend fun applyServerClassification(
        context: Context,
        sender: String,
        body: String,
        notifId: Int,
        messageId: Long?,
        result: SmsApi.IngestResult,
    ) {
        when (result.action) {
            SmsApi.Action.BLOCKED -> {
                persistClassification(context, messageId, "suspicious")
                // Older servers may still emit BLOCKED. Treat it as a
                // high-risk alert instead of changing the system block list;
                // the user must explicitly choose Block in Take Action.
                NotificationHelper.sendSuspiciousAlert(context, sender, notifId)
            }
            SmsApi.Action.ALERT -> {
                persistClassification(context, messageId, "spam")
                NotificationHelper.sendSpamAlert(context, sender, notifId)
            }
            SmsApi.Action.INBOX -> {
                persistClassification(context, messageId, "safe")
                NotificationHelper.sendMessageNotification(context, sender, body, notifId)
            }
        }
    }

    private suspend fun applyOfflineCaution(
        context: Context,
        repository: SmsRepository,
        sender: String,
        body: String,
        notifId: Int,
        messageId: Long?,
    ) {
        // The offline heuristic is a keyword/pattern score, not a confident AI
        // verdict — it can only ever land on "unknown" (reviewable) or
        // "unverified" (nothing suspicious found, but the backend never actually
        // checked it — deliberately not "safe", which is reserved for a genuine
        // backend verdict in applyBackendAction below). Never "blocked" (that
        // requires a real backend result) or "spam" (it has no way to detect
        // promotional content at all).
        val classification = repository.classifyMessagePublic(sender, body)
        // An offline heuristic is never a trustworthy verdict. Preserve the
        // neutral state so the inbox does not claim ML confidence it lacks.
        persistClassification(context, messageId, "unknown")
        when (classification) {
            "suspicious" -> {
                NotificationHelper.sendSuspiciousAlert(context, sender, notifId)
            }
            "unknown" -> {
                NotificationHelper.sendSuspiciousAlert(context, sender, notifId)
            }
            // A quiet fallback is only a normal incoming message, not a trust claim.
            else -> NotificationHelper.sendMessageNotification(context, sender, body, notifId)
        }
    }
}
