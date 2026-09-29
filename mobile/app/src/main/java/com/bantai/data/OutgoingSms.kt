package com.bantai.data

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.provider.Telephony
import android.util.Log
import android.widget.Toast
import com.bantai.data.model.SendStatus
import com.bantai.data.model.SmsMessage
import com.bantai.data.model.normalizeSenderKey
import com.bantai.util.NotificationHelper
import com.bantai.util.SmsSender
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
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
 * Only the default SMS app may write the provider. When BantAI isn't the
 * default, the "Sending…"/"failed" bubble lives in [pending] instead (the
 * system itself writes the message to Sent once it goes out), so the thread
 * still shows it right away.
 */
object OutgoingSms {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val mainHandler = Handler(Looper.getMainLooper())
    private val nextLocalId = AtomicLong(-1)

    private val _pending = MutableStateFlow<List<SmsMessage>>(emptyList())

    /** Outgoing messages with no provider row (negative ids). */
    val pending: StateFlow<List<SmsMessage>> = _pending.asStateFlow()

    fun send(
        context: Context,
        to: String,
        body: String,
    ) = start(context.applicationContext, to, body, retryOf = null)

    /** Re-sends a message shown as "Not delivered", reusing its bubble. */
    fun retry(
        context: Context,
        message: SmsMessage,
    ) = start(context.applicationContext, message.sender, message.body, retryOf = message)

    /**
     * Provider rows plus this thread's pending bubbles, oldest first. A sent
     * placeholder is dropped once the provider shows the same message.
     */
    fun mergeInto(
        sender: String,
        provider: List<SmsMessage>,
    ): List<SmsMessage> {
        val key = normalizeSenderKey(sender)
        val mine =
            _pending.value.filter { placeholder ->
                normalizeSenderKey(placeholder.sender) == key &&
                    !(placeholder.sendStatus == SendStatus.SENT && provider.any { it.sameMessageAs(placeholder) })
            }
        return if (mine.isEmpty()) provider else (provider + mine).sortedBy { it.timestamp }
    }

    fun discard(localIds: Collection<Long>) {
        if (localIds.isEmpty()) return
        _pending.update { list -> list.filterNot { it.id in localIds } }
    }

    private fun start(
        context: Context,
        to: String,
        body: String,
        retryOf: SmsMessage?,
    ) {
        scope.launch {
            val repo = SmsRepository(context)
            val isDefault = Telephony.Sms.getDefaultSmsPackage(context) == context.packageName
            val providerId: Long?
            val localId: Long?
            when {
                retryOf != null && retryOf.id > 0 -> {
                    repo.updateMessageType(retryOf.id, Telephony.Sms.MESSAGE_TYPE_OUTBOX)
                    providerId = retryOf.id
                    localId = null
                }
                isDefault && retryOf == null -> {
                    providerId = repo.insertOutgoingMessage(to, body)
                    localId = if (providerId == null) nextLocalId.getAndDecrement() else null
                }
                else -> {
                    providerId = null
                    localId = retryOf?.id ?: nextLocalId.getAndDecrement()
                }
            }
            if (localId != null) putPending(localId, to, body, SendStatus.SENDING)

            try {
                SmsSender.send(context, to, body) { success, error ->
                    scope.launch { finish(context, repo, to, body, providerId, localId, success, error) }
                }
            } catch (e: SecurityException) {
                // SEND_SMS was revoked between the screen's check and here.
                Log.w(TAG, "SEND_SMS not granted", e)
                finish(context, repo, to, body, providerId, localId, false, "BantAI isn't allowed to send SMS")
            } catch (e: IllegalArgumentException) {
                Log.w(TAG, "Invalid SMS destination or body", e)
                finish(context, repo, to, body, providerId, localId, false, "Message could not be sent")
            }
        }
    }

    @Suppress("LongParameterList")
    private fun finish(
        context: Context,
        repo: SmsRepository,
        to: String,
        body: String,
        providerId: Long?,
        localId: Long?,
        success: Boolean,
        error: String?,
    ) {
        providerId?.let {
            val type = if (success) Telephony.Sms.MESSAGE_TYPE_SENT else Telephony.Sms.MESSAGE_TYPE_FAILED
            repo.updateMessageType(it, type)
        }
        localId?.let { putPending(it, to, body, if (success) SendStatus.SENT else SendStatus.FAILED) }
        if (success) {
            // The system's own Sent row normally replaces the placeholder within
            // a second; this only cleans up if that row never shows up.
            localId?.let { id -> mainHandler.postDelayed({ discard(listOf(id)) }, SENT_PLACEHOLDER_TTL_MS) }
            return
        }
        Log.w(TAG, "Send failed: $error")
        mainHandler.post { Toast.makeText(context, error ?: "Message not delivered", Toast.LENGTH_LONG).show() }
        // The result can land after the user has left the thread.
        NotificationHelper.sendFailedMessageNotification(context, to, body, NotificationHelper.notifIdFor(to))
    }

    private fun putPending(
        id: Long,
        to: String,
        body: String,
        status: SendStatus,
    ) {
        _pending.update { list ->
            val existing = list.firstOrNull { it.id == id }
            val updated =
                (existing ?: SmsMessage(id = id, sender = to, body = body, timestamp = System.currentTimeMillis()))
                    .copy(isOutgoing = true, classification = "safe", sendStatus = status)
            list.filterNot { it.id == id } + updated
        }
    }

    private fun SmsMessage.sameMessageAs(placeholder: SmsMessage): Boolean =
        isOutgoing &&
            body == placeholder.body &&
            kotlin.math.abs(timestamp - placeholder.timestamp) < SENT_PLACEHOLDER_TTL_MS
}
