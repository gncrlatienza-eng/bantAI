package com.bantai.data

import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.provider.Telephony
import android.util.Log
import com.bantai.BuildConfig
import com.bantai.data.local.BackendMessageIdStore
import com.bantai.data.local.ClassificationStore
import com.bantai.data.local.UserData
import com.bantai.data.local.UserPreferences
import com.bantai.data.remote.ApiConfig
import com.bantai.data.remote.SmsApi
import com.bantai.util.NotificationHelper
import com.bantai.util.SmsPrivacyMasker
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull

private const val TAG = "SmsIngestPipeline"
private const val MAX_EXTRACTED_DOMAINS = 20

// Mirrors the backend's own auto-block threshold (sms.service.ts routeFromLabel:
// Scam >= 0.90 -> 'blocked'). The backend no longer actually returns a 'blocked'
// action for a fresh classification (see routeFromLabel/effectiveAction) -- a
// missing/unavailable model result is never trusted to auto-block, and a
// confirmed-fraud verdict is deliberately downgraded to 'alert' so the user
// still has to choose Block/Report/Ignore explicitly. That means every
// high-confidence Scam that should be treated as smishing arrives here as
// action=ALERT with label="Scam" and a high score, not as action=BLOCKED --
// this constant lets the mobile side recognise that case on the same terms
// the backend uses, instead of silently downgrading it to a Spam-level alert.
private const val SCAM_HIGH_CONFIDENCE_THRESHOLD = 0.90

/** Which alert channel (if any) a routed classification should notify through. */
internal enum class AlertKind {
    /** No notification at all -- e.g. a sender already blocked server-side. */
    SILENT,
    SMISHING,
    SUSPICIOUS,
    SPAM,
    MESSAGE,
}

internal data class ClassificationRoute(
    val classification: String,
    val alertKind: AlertKind,
)

/**
 * Pure decision function for what a backend ingest result should mean locally
 * -- deliberately free of Context/notifications/persistence so it can be unit
 * tested directly (see SmsIngestPipelineRoutingTest) without an Android
 * runtime. This is the fix for the bug where every Spam *and* Scam result
 * (including a confirmed-fraud or >=90%-confidence Scam) was shown as the
 * same low-priority "Spam... hidden in your Spam folder" notification: the
 * backend's `action` field alone can no longer distinguish them (see the
 * SCAM_HIGH_CONFIDENCE_THRESHOLD comment above), so `label`/`score` have to
 * be consulted too.
 */
internal fun routeServerClassification(result: SmsApi.IngestResult): ClassificationRoute {
    if (result.suppressed) {
        // The sender is already on this user's block list server-side --
        // nothing new happened, so this stays silent rather than re-alerting
        // on every subsequent message from a number the user already dealt
        // with. See sms.service.ts: blocked senders short-circuit before any
        // classification work.
        return ClassificationRoute("blocked", AlertKind.SILENT)
    }
    return when (result.action) {
        // Real auto-block verdict (older servers, or a future backend change)
        // -- the highest-priority channel, matching what an actual auto-block
        // deserves.
        SmsApi.Action.BLOCKED -> ClassificationRoute("blocked", AlertKind.SMISHING)
        SmsApi.Action.ALERT ->
            when {
                result.label == "Scam" && result.score >= SCAM_HIGH_CONFIDENCE_THRESHOLD ->
                    ClassificationRoute("blocked", AlertKind.SMISHING)
                result.label == "Scam" -> ClassificationRoute("unknown", AlertKind.SUSPICIOUS)
                else -> ClassificationRoute("spam", AlertKind.SPAM)
            }
        SmsApi.Action.INBOX -> ClassificationRoute("safe", AlertKind.MESSAGE)
    }
}

/**
 * Shared entry point for turning a message (real, over-the-air SMS or a
 * synthetic one from the debug "Simulate incoming SMS" tool) into an inbox
 * row, a privacy-masked server classification when available, and a
 * notification. Raw SMS content never leaves the device; only locally masked
 * text is sent to the classifier.
 */
object SmsIngestPipeline {
    private data class NotificationTarget(
        val sender: String,
        val body: String,
        val notificationId: Int,
        val messageId: Long?,
    )

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
        val notificationId = (sender.hashCode() xor (System.currentTimeMillis() ushr 10).toInt()) and Int.MAX_VALUE
        val notification = NotificationTarget(sender, body, notificationId, messageId)

        if (token.isNotEmpty()) {
            val fallback = repository.classifyMessagePublic(body)
            val (label, score, bucket) = classificationMetadata(fallback)
            val sourceId = messageId?.toString() ?: "${sender.hashCode()}:$receivedAt"
            // withTimeoutOrNull bounds the whole call, including connect+read, at
            // timeoutMs -- SmsApi.ingest/HttpClient apply that same value to each
            // of connect and read separately, so a connection that succeeds just
            // under the limit but then reads slowly could otherwise take up to
            // ~2x timeoutMs, which for the receiver's 5s budget can eat the
            // entire goAsync() window before the offline fallback ever runs and
            // leave the message with no notification at all. The underlying
            // blocking HttpURLConnection call isn't itself interrupted -- it
            // keeps running on its IO thread until its own timeout -- but the
            // pipeline moves on immediately rather than waiting for it.
            val outcome =
                withTimeoutOrNull(timeoutMs.toLong()) {
                    SmsApi.ingest(
                        token,
                        SmsApi.IngestRequest(
                            sender = sender,
                            receivedAtMillis = receivedAt,
                            sourceId = sourceId,
                            maskedBody = SmsPrivacyMasker.maskForRemoteClassification(body),
                            label = label,
                            score = score,
                            bucket = bucket,
                            domains = extractDomains(body),
                            timeoutMs = timeoutMs,
                        ),
                    )
                }
            if (outcome == null) {
                Log.w(TAG, "Classification timed out; showing local caution only")
                applyOfflineCaution(context, repository, notification)
            } else {
                outcome
                    .onSuccess { result ->
                        applyServerClassification(context, notification, result)
                    }.onFailure {
                        Log.w(TAG, "Model classification unavailable; showing local caution only", it)
                        applyOfflineCaution(context, repository, notification)
                    }
            }
        } else {
            applyOfflineCaution(context, repository, notification)
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

    // Records the backend's own SmsMessage id against the local SMS provider row,
    // so Report/Block from a thread or an alert has something to submit against --
    // see BackendMessageIdStore's doc comment.
    private suspend fun persistBackendMessageId(
        context: Context,
        messageId: Long?,
        backendMessageId: String?,
    ) {
        if (messageId == null || backendMessageId.isNullOrEmpty()) return
        try {
            BackendMessageIdStore(context).set(messageId, backendMessageId)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to persist backend message id for $messageId", e)
        }
    }

    private fun classificationMetadata(classification: String): Triple<String, Double, String> =
        when (classification) {
            // classifyMessagePublic (the only caller of this function's input)
            // never returns "suspicious" -- see SmsRepository.classifyMessage's
            // doc comment, it only returns "unknown"/"unverified". Kept as an
            // explicit, defensive case rather than silently falling through to
            // "Ham" if that contract ever changes.
            "suspicious" -> Triple("Scam", 0.0, "unknown")
            "unknown" -> Triple("Spam", 0.0, "unknown")
            else -> Triple("Ham", 0.0, "unknown")
        }

    private fun extractDomains(body: String): List<String> =
        Regex("https?://([^/\\s?#]+)", RegexOption.IGNORE_CASE)
            .findAll(body)
            .map { it.groupValues[1].lowercase().removePrefix("www.") }
            .distinct()
            .take(MAX_EXTRACTED_DOMAINS)
            .toList()

    // Reads a single notification-toggle flag, defaulting to enabled if the
    // preference can't be read at all -- a broken read must never silently
    // suppress a smishing/suspicious alert the user never actually turned off.
    private suspend fun alertEnabled(
        context: Context,
        selector: (UserData) -> Boolean,
    ): Boolean = runCatching { selector(UserPreferences(context).userData.first()) }.getOrDefault(true)

    // When the corresponding toggle is off, the SMS still needs to be surfaced
    // somehow -- silently dropping it entirely would hide real messages, not
    // just quiet the high-priority channel the user opted out of.
    private suspend fun notifyHighRiskOrFallback(
        context: Context,
        target: NotificationTarget,
        toggle: (UserData) -> Boolean,
        sendHighRisk: () -> Unit,
    ) {
        if (alertEnabled(context, toggle)) {
            sendHighRisk()
        } else {
            NotificationHelper.sendMessageNotification(context, target.sender, target.body, target.notificationId)
        }
    }

    private suspend fun applyServerClassification(
        context: Context,
        target: NotificationTarget,
        result: SmsApi.IngestResult,
    ) {
        persistBackendMessageId(context, target.messageId, result.messageId)

        val route = routeServerClassification(result)
        persistClassification(context, target.messageId, route.classification)

        when (route.alertKind) {
            AlertKind.SILENT -> Unit
            AlertKind.SMISHING ->
                notifyHighRiskOrFallback(context, target, { it.smishingAlerts }) {
                    NotificationHelper.sendSmishingAlert(context, target.sender, target.notificationId)
                }
            AlertKind.SUSPICIOUS ->
                notifyHighRiskOrFallback(context, target, { it.suspiciousAlerts }) {
                    NotificationHelper.sendSuspiciousAlert(context, target.sender, target.notificationId)
                }
            AlertKind.SPAM -> NotificationHelper.sendSpamAlert(context, target.sender, target.notificationId)
            AlertKind.MESSAGE ->
                NotificationHelper.sendMessageNotification(context, target.sender, target.body, target.notificationId)
        }
    }

    private suspend fun applyOfflineCaution(
        context: Context,
        repository: SmsRepository,
        target: NotificationTarget,
    ) {
        // The offline heuristic is a keyword/pattern score, not a confident AI
        // verdict — it can only ever land on "unknown" (reviewable) or
        // "unverified" (nothing suspicious found, but the backend never actually
        // checked it — deliberately not "safe", which is reserved for a genuine
        // backend verdict in applyServerClassification above). Never "blocked"
        // (that requires a real backend result) or "spam" (it has no way to
        // detect promotional content at all).
        val classification = repository.classifyMessagePublic(target.body)
        // Persist the actual heuristic result ("unknown" or "unverified"), not a
        // hardcoded value -- MessagesViewModel/MessageDetailScreen/MessagesScreen
        // all treat the two differently (review bucket + warning banner vs. a
        // neutral badge), so collapsing them here would misclassify every clean
        // offline message as reviewable.
        persistClassification(context, target.messageId, classification)
        when (classification) {
            // classifyMessagePublic never actually returns "suspicious" (see
            // SmsRepository.classifyMessage) -- kept as an explicit, defensive
            // case rather than silently falling through to the quiet-notification
            // branch if that contract ever changes.
            "suspicious", "unknown" -> {
                notifyHighRiskOrFallback(context, target, { it.suspiciousAlerts }) {
                    NotificationHelper.sendSuspiciousAlert(context, target.sender, target.notificationId)
                }
            }
            // A quiet fallback is only a normal incoming message, not a trust claim.
            else ->
                NotificationHelper.sendMessageNotification(
                    context,
                    target.sender,
                    target.body,
                    target.notificationId,
                )
        }
    }
}
