package com.bantai.data

import android.content.Context
import android.util.Log
import com.bantai.container
import com.bantai.data.local.UserData
import com.bantai.data.model.Classification
import com.bantai.data.model.SmsMessage
import com.bantai.data.remote.ApiConfig
import com.bantai.data.remote.ApiException
import com.bantai.data.remote.SmsApi
import com.bantai.util.BlockHelper
import com.bantai.util.DefaultSmsApp
import com.bantai.util.NotificationHelper
import com.bantai.util.SmsPrivacyMasker
import com.bantai.util.SmsSourceId
import com.bantai.util.TransactionalMessage
import com.bantai.util.TrustedSenders
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

private const val TAG = "SmsIngestPipeline"
private const val MAX_EXTRACTED_DOMAINS = 20
private const val MAX_SENDER_LENGTH = 64
private const val MAX_MASKED_BODY_LENGTH = 1600

// 401 means the session expired and 408/429 are transient; none of them say
// anything is wrong with the individual message, so the scan stops instead.
private const val HTTP_UNAUTHORIZED = 401
private const val HTTP_REQUEST_TIMEOUT = 408
private const val HTTP_TOO_MANY_REQUESTS = 429
private const val HTTP_CLIENT_ERROR_MIN = 400
private const val HTTP_CLIENT_ERROR_MAX = 499
private val HTTP_CLIENT_ERRORS = HTTP_CLIENT_ERROR_MIN..HTTP_CLIENT_ERROR_MAX
private val RETRYABLE_CLIENT_STATUSES = setOf(HTTP_UNAUTHORIZED, HTTP_REQUEST_TIMEOUT, HTTP_TOO_MANY_REQUESTS)

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
internal const val SCAM_HIGH_CONFIDENCE_THRESHOLD = 0.90

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
    val classification: Classification,
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
@Suppress("CyclomaticComplexMethod") // one branch per backend action/label combination
internal fun routeServerClassification(result: SmsApi.IngestResult): ClassificationRoute {
    if (result.suppressed) {
        // The sender is already on this user's block list server-side --
        // nothing new happened, so this stays silent rather than re-alerting
        // on every subsequent message from a number the user already dealt
        // with. See sms.service.ts: blocked senders short-circuit before any
        // classification work.
        return ClassificationRoute(Classification.SCAM, AlertKind.SILENT)
    }
    return when (result.action) {
        // Real auto-block verdict (older servers, or a future backend change)
        // -- the highest-priority channel, matching what an actual auto-block
        // deserves.
        SmsApi.Action.BLOCKED -> ClassificationRoute(Classification.SCAM, AlertKind.SMISHING)
        SmsApi.Action.ALERT ->
            when {
                result.label == "Scam" && result.score >= SCAM_HIGH_CONFIDENCE_THRESHOLD ->
                    ClassificationRoute(Classification.SCAM, AlertKind.SMISHING)
                // Spam no longer creates an Alert, so an ALERT without a Scam
                // label means the sender is confirmed fraud (sms.service.ts
                // effectiveAction). It goes to review: filing it as Spam gave it
                // the low-priority notification (none at all with spam
                // notifications off), and TransactionalMessage could then pass a
                // fake receipt as a normal message. Not SCAM: confirmed fraud
                // never blocks silently.
                else -> ClassificationRoute(Classification.UNKNOWN, AlertKind.SUSPICIOUS)
            }
        // The backend now returns INBOX for everything that isn't smishing (Spam
        // no longer creates an Alert row), so the label/bucket decide the chip.
        // Before this, an uncertain Scam (bucket "unknown") also came back as
        // INBOX and was wrongly filed as safe.
        SmsApi.Action.INBOX ->
            when {
                // With the model down the backend only echoes this device's own
                // heuristic (always bucket "unknown"; label Spam when it found
                // something) -- mirror applyOfflineCaution, never claim "safe".
                result.classificationSource == "device_fallback" ->
                    if (result.label == "Spam" || result.label == "Scam") {
                        ClassificationRoute(Classification.UNKNOWN, AlertKind.SUSPICIOUS)
                    } else {
                        ClassificationRoute(Classification.UNVERIFIED, AlertKind.MESSAGE)
                    }
                result.label == "Scam" || result.bucket == "unknown" ->
                    ClassificationRoute(Classification.UNKNOWN, AlertKind.SUSPICIOUS)
                result.label == "Spam" || result.bucket == "spam" ->
                    ClassificationRoute(Classification.SPAM, AlertKind.SPAM)
                else -> ClassificationRoute(Classification.SAFE, AlertKind.MESSAGE)
            }
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
        // The thread a tap opens: a group MMS's group, otherwise [sender].
        val conversationKey: String = sender,
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
        val isDefaultSmsApp = DefaultSmsApp.isDefault(context)
        val messageId = if (isDefaultSmsApp) storeMessage(context, sender, body, receivedAt, sentAt) else null
        val token =
            runCatching {
                context.container.userPreferences.userData
                    .first()
                    .authToken
            }.getOrDefault("")
        classifyAndNotify(
            context,
            token,
            sender,
            body,
            receivedAt,
            messageId,
            timeoutMs = ApiConfig.SIMULATE_TIMEOUT_MS,
        )
    }

    @Suppress("LongParameterList") // one parameter per SMS field
    fun storeMessage(
        context: Context,
        sender: String,
        body: String,
        receivedAt: Long,
        sentAt: Long,
        subId: Int = -1,
    ): Long? =
        // Falls back to BantAI's own store when Android drops the write (fake
        // ".../0" answer with WRITE_SMS blocked) -- incoming texts used to be
        // lost outright then, with a verdict attached to "message 0".
        context.container.smsWriter.insertIncomingMessage(sender, body, receivedAt, sentAt, subId)

    /**
     * Requests the deployed model using locally masked text. Offline keyword
     * rules can show a caution, but cannot block a sender. High-risk model and
     * fraud results open an alert so the user can choose Block, Report, or
     * Ignore explicitly.
     */
    @Suppress("LongParameterList") // one value per piece of the incoming SMS
    suspend fun classifyAndNotify(
        context: Context,
        token: String,
        sender: String,
        body: String,
        receivedAt: Long,
        messageId: Long?,
        timeoutMs: Int = ApiConfig.SMS_TIMEOUT_MS,
        conversationKey: String = sender,
    ) {
        // Notification ID: XOR of sender hash and truncated timestamp avoids
        // the collision caused by System.currentTimeMillis().toInt() overflow.
        val notificationId = (sender.hashCode() xor (System.currentTimeMillis() ushr 10).toInt()) and Int.MAX_VALUE
        val notification = NotificationTarget(sender, body, notificationId, messageId, conversationKey)

        if (token.isNotEmpty()) {
            val fallback = MessageClassifier.classify(body)
            val (label, score, bucket) = classificationMetadata(fallback)
            val sourceId =
                messageId?.let { SmsSourceId.forRow(context, it) }
                    ?: SmsSourceId.forUnstoredMessage(context, sender, receivedAt)
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
                applyOfflineCaution(context, notification)
            } else {
                outcome
                    .onSuccess { result ->
                        applyServerClassification(context, token, notification, result)
                    }.onFailure {
                        Log.w(TAG, "Model classification unavailable; showing local caution only", it)
                        applyOfflineCaution(context, notification)
                    }
            }
        } else {
            applyOfflineCaution(context, notification)
        }
    }

    sealed interface ScanOutcome {
        data class Classified(
            val classification: Classification,
        ) : ScanOutcome

        /** The backend rejected this one message; the scan should move on. */
        data object Skipped : ScanOutcome

        /** The model, backend, or session is unavailable; the scan should stop. */
        data object Unavailable : ScanOutcome
    }

    /**
     * Classifies a message that is already in the inbox (history from before
     * install, or one that arrived while the model was unreachable) without
     * notifying. Uses the same masked ingest path and sourceId as a live SMS, so
     * the backend treats a repeat as idempotent. A device-fallback echo counts
     * as Unavailable: it must not overwrite the on-device result with something
     * that only looks like a model verdict.
     */
    @Suppress("ReturnCount") // each early return is a distinct scan outcome
    suspend fun classifyExisting(
        context: Context,
        token: String,
        message: SmsMessage,
    ): ScanOutcome {
        val outcome = SmsApi.ingest(token, existingMessageRequest(context, message))
        val result =
            outcome.getOrElse { error ->
                val status = (error as? ApiException)?.status
                return if (status != null && status in HTTP_CLIENT_ERRORS && status !in RETRYABLE_CLIENT_STATUSES) {
                    Log.w(TAG, "Backend rejected message ${message.id} during inbox scan (HTTP $status)")
                    ScanOutcome.Skipped
                } else {
                    ScanOutcome.Unavailable
                }
            }
        if (!result.suppressed && result.classificationSource != "model") return ScanOutcome.Unavailable
        persistBackendMessageId(context, message.id, result.messageId)
        persistCampaignMatch(context, message.id, result)
        val route = routeServerClassification(result)
        // Same rule as a live SMS (handledAsScam), minus the notification: a
        // confirmed scam already sitting in the inbox blocks its sender too,
        // while a trusted (built-in or registry-verified), saved-contact or
        // user-unblocked sender's scam verdict is kept as UNKNOWN for review. Returning SCAM
        // for those used to hide a registry org's thread: resolve() only
        // corrects built-in names on read.
        if (route.classification == Classification.SCAM && !result.suppressed) {
            if (TrustedSenders.neverAutoBlock(message.sender, result.senderStatus) ||
                userUnblocked(context, message.sender)
            ) {
                return ScanOutcome.Classified(Classification.UNKNOWN)
            }
            autoBlockSender(context, token, message.sender)
        }
        return ScanOutcome.Classified(route.classification)
    }

    /**
     * The backend SmsMessage id a report has to attach to. Messages the scan or
     * a live SMS already sent have one stored; anything else is ingested on the
     * spot (same masked path) so every message can be reported, whatever its
     * label. Null when the local row is gone or the sender is already blocked
     * server-side (the backend stores nothing for those).
     */
    @Suppress("ReturnCount") // each early return is a distinct reason there is no backend id
    suspend fun backendMessageIdFor(
        context: Context,
        token: String,
        localMessageId: Long,
    ): String? {
        context.container.backendMessageIdStore
            .get(localMessageId)
            ?.takeIf { it.isNotEmpty() }
            ?.let { return it }
        val message =
            withContext(Dispatchers.IO) {
                context.container.smsRepository.getMessageById(localMessageId)
            } ?: return null
        val result = SmsApi.ingest(token, existingMessageRequest(context, message)).getOrNull() ?: return null
        if (result.suppressed) return null
        persistBackendMessageId(context, localMessageId, result.messageId)
        return result.messageId
    }

    private fun existingMessageRequest(
        context: Context,
        message: SmsMessage,
    ): SmsApi.IngestRequest {
        val (label, score, bucket) = classificationMetadata(MessageClassifier.classify(message.body))
        return SmsApi.IngestRequest(
            // Trimmed to IngestSmsDto's limits so a long multi-part message
            // isn't rejected outright.
            sender = message.sender.take(MAX_SENDER_LENGTH),
            receivedAtMillis = message.timestamp,
            sourceId = SmsSourceId.forRow(context, message.id),
            maskedBody = SmsPrivacyMasker.maskForRemoteClassification(message.body).take(MAX_MASKED_BODY_LENGTH),
            label = label,
            score = score,
            bucket = bucket,
            domains = extractDomains(message.body),
        )
    }

    // Persist the result that actually drove the local protection decision.
    private suspend fun persistClassification(
        context: Context,
        messageId: Long?,
        classification: Classification,
    ) {
        if (messageId == null) return
        try {
            context.container.classificationStore.setClassification(messageId, classification)
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
            context.container.backendMessageIdStore.set(messageId, backendMessageId)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to persist backend message id for $messageId", e)
        }
    }

    /**
     * A confirmed scam blocks its sender automatically and stays in Alerts as a
     * learning record. A trusted sender (telco, or registry organisation) or a
     * saved contact is never auto-blocked: its message is kept as "needs review", notified like
     * any smishing alert, and the user decides whether to block or report.
     * Returns true when this fully handled the message.
     */
    private suspend fun handledAsScam(
        context: Context,
        token: String,
        target: NotificationTarget,
        result: SmsApi.IngestResult,
        route: ClassificationRoute,
    ): Boolean {
        if (route.classification != Classification.SCAM || result.suppressed) return false
        if (TrustedSenders.neverAutoBlock(target.sender, result.senderStatus) ||
            userUnblocked(context, target.sender)
        ) {
            persistClassification(context, target.messageId, Classification.UNKNOWN)
            notifyHighRiskOrFallback(context, target, { it.smishingAlerts }) {
                NotificationHelper.sendSmishingAlert(context, target.sender, target.notificationId)
            }
            return true
        }
        persistClassification(context, target.messageId, Classification.SCAM)
        autoBlockSender(context, token, target.sender)
        // Settings → Notifications → "Auto-block notice". It used to read the
        // smishing toggle, so the auto-block switch did nothing.
        if (alertEnabled(context) { it.autoBlockNotice }) {
            NotificationHelper.sendScamBlockedNotice(context, target.sender, target.notificationId)
        }
        return true
    }

    // Blocks on the device when BantAI is the default SMS app (Android refuses
    // anyone else), on the backend so later texts from this sender are
    // suppressed server-side either way, and in BlockedSendersStore so the
    // block shows up in Blocked Numbers. See BlockHelper.blockSender.
    private suspend fun autoBlockSender(
        context: Context,
        token: String,
        sender: String,
    ) {
        val outcome = BlockHelper.blockSender(context, token, sender)
        if (!outcome.blocked) Log.w(TAG, "Auto-block didn't land on the device or the server")
    }

    // A sender the user unblocked stays unblocked: a later scam verdict from it
    // is surfaced for review instead of silently re-blocking it.
    private suspend fun userUnblocked(
        context: Context,
        sender: String,
    ): Boolean =
        runCatching {
            sender in
                context.container.blockedSendersStore
                    .current()
                    .userUnblocked
        }.getOrDefault(false)

    // Feeds the on-device Campaigns grouping (see LocalCampaigns.kt). Skipped for
    // a backend that doesn't send `campaign` at all, so an old server's silence
    // isn't recorded as "checked, no campaign".
    private suspend fun persistCampaignMatch(
        context: Context,
        messageId: Long?,
        result: SmsApi.IngestResult,
    ) {
        if (messageId == null || result.suppressed || !result.campaignKnown) return
        try {
            context.container.campaignMatchStore.set(messageId, result.campaign)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to persist campaign match for $messageId", e)
        }
    }

    // The on-device heuristic only ever returns UNKNOWN or UNVERIFIED (see
    // SmsRepository.classifyMessage).
    private fun classificationMetadata(classification: Classification): Triple<String, Double, String> =
        when (classification) {
            Classification.UNKNOWN -> Triple("Spam", 0.0, "unknown")
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
    ): Boolean =
        runCatching {
            selector(
                context.container.userPreferences.userData
                    .first(),
            )
        }.getOrDefault(true)

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
            NotificationHelper.sendMessageNotification(
                context,
                target.sender,
                target.body,
                target.notificationId,
                target.conversationKey,
            )
        }
    }

    private suspend fun applyServerClassification(
        context: Context,
        token: String,
        target: NotificationTarget,
        result: SmsApi.IngestResult,
    ) {
        persistBackendMessageId(context, target.messageId, result.messageId)
        persistCampaignMatch(context, target.messageId, result)

        val route = routeServerClassification(result)
        if (handledAsScam(context, token, target, result, route)) return
        persistClassification(context, target.messageId, route.classification)
        // A receipt/confirmation the model called Spam is shown as a normal
        // message (see TransactionalMessage), so it must not notify as spam.
        val alertKind =
            if (route.alertKind == AlertKind.SPAM && TransactionalMessage.isTransactional(target.body)) {
                AlertKind.MESSAGE
            } else {
                route.alertKind
            }

        when (alertKind) {
            AlertKind.SILENT -> Unit
            AlertKind.SMISHING ->
                notifyHighRiskOrFallback(context, target, { it.smishingAlerts }) {
                    NotificationHelper.sendSmishingAlert(context, target.sender, target.notificationId)
                }
            AlertKind.SUSPICIOUS ->
                notifyHighRiskOrFallback(context, target, { it.suspiciousAlerts }) {
                    NotificationHelper.sendSuspiciousAlert(context, target.sender, target.notificationId)
                }
            // Unlike smishing/suspicious, turning spam off means no notification at
            // all rather than a plain-message fallback: the SMS is still filed in
            // the Spam folder, so nothing is hidden, and promos are exactly the
            // noise a user turns this off to avoid.
            AlertKind.SPAM ->
                if (alertEnabled(context) { it.spamAlerts }) {
                    NotificationHelper.sendSpamAlert(context, target.sender, target.notificationId)
                }
            AlertKind.MESSAGE ->
                NotificationHelper.sendMessageNotification(
                    context,
                    target.sender,
                    target.body,
                    target.notificationId,
                    target.conversationKey,
                )
        }
    }

    private suspend fun applyOfflineCaution(
        context: Context,
        target: NotificationTarget,
    ) {
        // The offline heuristic is a keyword/pattern score, not a confident AI
        // verdict — it can only ever land on "unknown" (reviewable) or
        // "unverified" (nothing suspicious found, but the backend never actually
        // checked it — deliberately not "safe", which is reserved for a genuine
        // backend verdict in applyServerClassification above). Never "blocked"
        // (that requires a real backend result) or "spam" (it has no way to
        // detect promotional content at all).
        val classification = MessageClassifier.classify(target.body)
        // Persist the actual heuristic result ("unknown" or "unverified"), not a
        // hardcoded value -- MessagesViewModel/MessageDetailScreen/MessagesScreen
        // all treat the two differently (review bucket + warning banner vs. a
        // neutral badge), so collapsing them here would misclassify every clean
        // offline message as reviewable.
        persistClassification(context, target.messageId, classification)
        when (classification) {
            Classification.UNKNOWN -> {
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
                    target.conversationKey,
                )
        }
    }
}
