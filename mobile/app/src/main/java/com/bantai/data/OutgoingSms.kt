package com.bantai.data

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.Telephony
import android.util.Log
import android.widget.Toast
import com.bantai.R
import com.bantai.container
import com.bantai.data.model.Classification
import com.bantai.data.model.SendStatus
import com.bantai.data.model.SmsMessage
import com.bantai.data.model.normalizeSenderKey
import com.bantai.mms.MmsImageCompressor
import com.bantai.mms.MmsSender
import com.bantai.util.DefaultSmsApp
import com.bantai.util.NotificationHelper
import com.bantai.util.SmsSender
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicLong

private const val TAG = "OutgoingSms"

// A sent message the system hasn't written to the provider yet stays visible
// this long at most; after that the provider's own row is the source of truth.
private const val SENT_PLACEHOLDER_TTL_MS = 60_000L

/**
 * One place that sends an SMS and records its outcome, iPhone-style: the
 * bubble appears immediately as "Sending…", then becomes a normal sent message
 * or "Not delivered · Tap to retry".
 *
 * Runs in its own process-wide scope rather than a screen's. Compose used to
 * record the result in its composable scope and then navigate away, which
 * cancelled that scope, so the message stayed "Sending…" forever.
 *
 * As the default SMS app, BantAI records the message itself (OUTBOX right
 * away, then SENT/FAILED). SmsWriter keeps it in BantAI's own store when
 * Android refuses the write, so it's never lost either way. When BantAI isn't
 * the default, the system writes the Sent row; until it shows up, the bubble is
 * a short-lived placeholder in [pending].
 */
object OutgoingSms {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val mainHandler = Handler(Looper.getMainLooper())
    private val nextLocalId = AtomicLong(-1)

    private val _pending = MutableStateFlow<List<SmsMessage>>(emptyList())

    /** In-flight messages with no stored row yet (negative ids). */
    val pending: StateFlow<List<SmsMessage>> = _pending.asStateFlow()

    /** Kept for callers that load state on start; stored messages come from SmsRepository now. */
    fun ensureLoaded(
        @Suppress("UNUSED_PARAMETER") context: Context,
    ) = Unit

    fun send(
        context: Context,
        to: String,
        body: String,
        subId: Int = -1,
    ) = start(context.applicationContext, to, body, subId, retryOf = null)

    /**
     * A picture or group message (see needsMms). The photos are shrunk to the
     * carrier's size limit here, off the main thread. Its bubble comes from
     * the saved outbox row, not [pending]; MmsSender and MmsSentReceiver
     * settle it.
     */
    fun sendMms(
        context: Context,
        recipients: List<String>,
        body: String,
        photos: List<Uri>,
        subId: Int = -1,
    ) {
        val appContext = context.applicationContext
        scope.launch {
            val budget =
                MmsImageCompressor.budgetPerImage(MmsImageCompressor.maxMessageBytes(appContext, subId), photos.size)
            val attachments = photos.mapNotNull { MmsImageCompressor.compress(appContext, it, budget) }
            if (attachments.size < photos.size) {
                mainHandler.post { Toast.makeText(appContext, R.string.mms_photo_failed, Toast.LENGTH_LONG).show() }
                return@launch
            }
            val start =
                runCatching { MmsSender.send(appContext, recipients, body, attachments, subId) }
                    .onFailure { Log.w(TAG, "MMS send failed to start", it) }
                    .getOrDefault(MmsSender.Start.NOT_SAVED)
            showMmsUnavailable(appContext, start)
        }
    }

    /** Re-sends a message shown as "Not delivered", reusing its bubble. */
    fun retry(
        context: Context,
        message: SmsMessage,
    ) {
        if (isMmsId(message.id)) {
            val appContext = context.applicationContext
            scope.launch {
                val rowId = message.id - MMS_ID_OFFSET
                val start = runCatching { MmsSender.resend(appContext, rowId) }.getOrDefault(MmsSender.Start.NOT_SAVED)
                showMmsUnavailable(appContext, start)
            }
            return
        }
        start(context.applicationContext, message.sender, message.body, message.subId, retryOf = message)
    }

    // Why an MMS didn't start; nothing is shown when it did.
    private fun showMmsUnavailable(
        context: Context,
        start: MmsSender.Start,
    ) {
        val text =
            when (start) {
                MmsSender.Start.STARTED -> return
                // MMS needs BantAI to be the default SMS app (it has to store what it sends).
                MmsSender.Start.NOT_DEFAULT_APP -> R.string.mms_needs_default_app
                MmsSender.Start.MOBILE_DATA_OFF -> R.string.mms_needs_mobile_data
                MmsSender.Start.NOT_SAVED -> R.string.mms_not_sent
            }
        mainHandler.post { Toast.makeText(context, text, Toast.LENGTH_LONG).show() }
    }

    /**
     * Stored rows plus this thread's pending bubbles, oldest first. A sent
     * placeholder is dropped once the stored rows show the same message.
     */
    fun mergeInto(
        sender: String,
        provider: List<SmsMessage>,
    ): List<SmsMessage> {
        val key = normalizeSenderKey(sender)
        val mine = unsaved(provider).filter { normalizeSenderKey(it.sender) == key }
        return if (mine.isEmpty()) provider else (provider + mine).sortedBy { it.timestamp }
    }

    /** Pending bubbles the stored rows don't show yet, across all threads. */
    fun unsaved(provider: List<SmsMessage>): List<SmsMessage> =
        _pending.value.filterNot { placeholder ->
            placeholder.sendStatus == SendStatus.SENT && provider.any { it.sameMessageAs(placeholder) }
        }

    fun discard(
        localIds: Collection<Long>,
        @Suppress("UNUSED_PARAMETER") context: Context? = null,
    ) {
        if (localIds.isEmpty()) return
        _pending.update { list -> list.filterNot { it.id in localIds } }
    }

    /** Sign-out: drop every in-flight bubble. */
    fun clearAll(
        @Suppress("UNUSED_PARAMETER") context: Context,
    ) {
        _pending.value = emptyList()
    }

    @Suppress("LongParameterList")
    private fun start(
        context: Context,
        to: String,
        body: String,
        subId: Int,
        retryOf: SmsMessage?,
    ) {
        scope.launch {
            val repo = context.container.smsWriter
            val isDefault = DefaultSmsApp.isDefault(context)
            val storedId: Long?
            val localId: Long?
            when {
                // A stored message (real row or BantAI's own copy): reuse it.
                retryOf != null && _pending.value.none { it.id == retryOf.id } -> {
                    repo.updateMessageType(retryOf.id, Telephony.Sms.MESSAGE_TYPE_OUTBOX)
                    storedId = retryOf.id
                    localId = null
                }
                isDefault && retryOf == null -> {
                    storedId = repo.insertOutgoingMessage(to, body, subId)
                    localId = if (storedId == null) nextLocalId.getAndDecrement() else null
                }
                else -> {
                    storedId = null
                    localId = retryOf?.id ?: nextLocalId.getAndDecrement()
                }
            }
            if (localId != null) putPending(localId, to, body, subId, SendStatus.SENDING)

            val outcome = Outcome(context, repo, to, body, subId, storedId, localId)
            // A delivery report needs a real SMS row to land on (see DeliveryReceiver).
            val deliveryRowId = storedId?.takeIf { it > 0 && deliveryReportsOn(context) }
            deliveryRowId?.let { repo.updateDeliveryStatus(it, Telephony.Sms.STATUS_PENDING) }
            try {
                SmsSender.send(context, to, body, subId, deliveryRowId) { success, error ->
                    scope.launch { finish(outcome, success, error) }
                }
            } catch (e: SecurityException) {
                // SEND_SMS was revoked between the screen's check and here.
                Log.w(TAG, "SEND_SMS not granted", e)
                finish(outcome, false, "BantAI isn't allowed to send SMS")
            } catch (e: IllegalArgumentException) {
                Log.w(TAG, "Invalid SMS destination or body", e)
                finish(outcome, false, "Message could not be sent")
            }
        }
    }

    private suspend fun deliveryReportsOn(context: Context): Boolean =
        runCatching {
            context.container.userPreferences.userData
                .first()
                .deliveryReports
        }.getOrDefault(false)

    @Suppress("LongParameterList") // one field per piece of the send
    private class Outcome(
        val context: Context,
        val repo: SmsWriter,
        val to: String,
        val body: String,
        val subId: Int,
        val storedId: Long?,
        val localId: Long?,
    )

    // Can run twice for one send: a timeout failure, then the carrier's late
    // success (see SmsSender). The second call corrects the first.
    // Sent / failed / late-success paths, for stored and unstored sends.
    @Suppress("CyclomaticComplexMethod", "ComplexCondition")
    private fun finish(
        o: Outcome,
        success: Boolean,
        error: String?,
    ) {
        val type = if (success) Telephony.Sms.MESSAGE_TYPE_SENT else Telephony.Sms.MESSAGE_TYPE_FAILED
        val updated = o.storedId?.let { o.repo.updateMessageType(it, type) } ?: false
        // No stored row to update: as the default app, record the finished send
        // now (the repository keeps it locally if Android refuses).
        if (!updated &&
            success &&
            o.localId != null &&
            DefaultSmsApp.isDefault(o.context)
        ) {
            o.repo.insertSentMessage(o.to, o.body, o.subId)?.let { discard(listOf(o.localId)) }
        }
        if (o.localId != null && _pending.value.any { it.id == o.localId }) {
            putPending(o.localId, o.to, o.body, o.subId, if (success) SendStatus.SENT else SendStatus.FAILED)
        }
        val failureNotifId = NotificationHelper.failedSendNotifIdFor(o.to)
        if (success) {
            // A late success after a timeout: take back the "not delivered" alert.
            NotificationHelper.cancel(o.context, failureNotifId)
            // The system's own Sent row normally replaces the placeholder within
            // a second; this only cleans up if that row never shows up.
            o.localId?.let { id -> mainHandler.postDelayed({ discard(listOf(id)) }, SENT_PLACEHOLDER_TTL_MS) }
            return
        }
        Log.w(TAG, "Send failed: $error")
        mainHandler.post { Toast.makeText(o.context, error ?: "Message not delivered", Toast.LENGTH_LONG).show() }
        // The result can land after the user has left the thread.
        NotificationHelper.sendFailedMessageNotification(o.context, o.to, o.body, failureNotifId)
    }

    private fun putPending(
        id: Long,
        to: String,
        body: String,
        subId: Int,
        status: SendStatus,
    ) {
        _pending.update { list ->
            val existing = list.firstOrNull { it.id == id }
            val updated =
                (existing ?: SmsMessage(id = id, sender = to, body = body, timestamp = System.currentTimeMillis()))
                    .copy(
                        isOutgoing = true,
                        classification = Classification.SAFE,
                        isRead = true,
                        sendStatus = status,
                        subId = subId,
                    )
            list.filterNot { it.id == id } + updated
        }
    }

    private fun SmsMessage.sameMessageAs(placeholder: SmsMessage): Boolean =
        isOutgoing &&
            body == placeholder.body &&
            kotlin.math.abs(timestamp - placeholder.timestamp) < SENT_PLACEHOLDER_TTL_MS
}
