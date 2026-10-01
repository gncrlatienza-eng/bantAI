package com.bantai.mms

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Telephony
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import android.util.Log
import android.widget.Toast
import com.bantai.R
import com.bantai.data.MmsReader
import com.bantai.data.model.groupKey
import com.bantai.data.model.normalizeSenderKey
import com.bantai.mms.pdu.PduComposer
import com.bantai.mms.pdu.SendReq
import com.bantai.receiver.MmsSentReceiver
import com.bantai.util.DefaultSmsApp
import com.bantai.util.NotificationHelper
import com.bantai.util.SmsSender
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap

private const val TAG = "MmsSender"

/**
 * How long an MMS may stay "Sending…". Android's MMS service waits for a
 * mobile-data connection with no limit of its own on some phones (a Huawei
 * with no data registration waited 6+ minutes and never answered), so the
 * bubble would never settle. A real answer arriving later still corrects it.
 */
const val MMS_SEND_TIMEOUT_MS = 3 * 60 * 1000L

/**
 * Sends picture and group messages. The message is saved first as an outbox
 * row, so its bubble shows "Sending…" at once; MmsSentReceiver then moves it
 * to Sent, or to Failed ("Not delivered · Tap to retry", which calls
 * [resend]). Only the default SMS app can do this: Android's MMS service
 * leaves storing the message to that app.
 *
 * Every call here does provider work: call it off the main thread.
 */
object MmsSender {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val mainHandler = Handler(Looper.getMainLooper())

    // The latest attempt per MMS row: a retry starts a fresh 3-minute timer,
    // and the first attempt's timer must not then fail the retry early.
    private val attempts = ConcurrentHashMap<Long, Long>()

    /** Whether an MMS send got going, or why not. */
    enum class Start { STARTED, NOT_DEFAULT_APP, MOBILE_DATA_OFF, NOT_SAVED }

    /** The conversation an MMS to [recipients] lands in (creating the phone's thread if needed). */
    fun conversationKeyFor(
        context: Context,
        recipients: List<String>,
    ): String =
        if (recipients.size > 1) {
            groupKey(Telephony.Threads.getOrCreateThreadId(context, recipients.toSet()))
        } else {
            normalizeSenderKey(recipients.single())
        }

    /** Saves and hands the MMS to the phone; anything but STARTED means nothing was sent. */
    @Suppress("ReturnCount") // one early return per reason it can't start
    fun send(
        context: Context,
        recipients: List<String>,
        text: String,
        attachments: List<MmsAttachment>,
        subId: Int,
    ): Start {
        if (recipients.isEmpty()) return Start.NOT_SAVED
        if (!DefaultSmsApp.isDefault(context)) return Start.NOT_DEFAULT_APP
        if (mobileDataOff(context)) return Start.MOBILE_DATA_OFF
        val threadId = Telephony.Threads.getOrCreateThreadId(context, recipients.toSet())
        val req = MmsMessageBuilder.build(recipients, text, attachments)
        val rowId = MmsPersister.persistOutgoing(context, req, recipients, threadId, subId) ?: return Start.NOT_SAVED
        MmsReader.invalidate()
        val notice = Notice(conversationKeyFor(context, recipients), preview(text, attachments))
        dispatch(context, req, rowId, subId, notice)
        return Start.STARTED
    }

    /** "Not delivered · Tap to retry" on a failed MMS: the same message, sent again. */
    @Suppress("ReturnCount") // one early return per reason it can't start
    fun resend(
        context: Context,
        rowId: Long,
    ): Start {
        if (!DefaultSmsApp.isDefault(context)) return Start.NOT_DEFAULT_APP
        val stored = MmsPersister.loadOutgoing(context, rowId) ?: return Start.NOT_SAVED
        if (mobileDataOff(context)) return Start.MOBILE_DATA_OFF
        MmsPersister.setBox(context, rowId, Telephony.Mms.MESSAGE_BOX_OUTBOX)
        MmsReader.invalidate()
        val req = MmsMessageBuilder.build(stored.recipients, stored.text, stored.attachments)
        val key = conversationKeyFor(context, stored.recipients)
        dispatch(context, req, rowId, stored.subId, Notice(key, preview(stored.text, stored.attachments)))
        return Start.STARTED
    }

    /**
     * MMS only travels over mobile data (never Wi-Fi), so with mobile data
     * switched off it can't go at all; checked up front to say so at once.
     *
     * The phone's mobile-data SIM is checked, not the sending SIM: on a
     * dual-SIM phone data is usually on one SIM only (say Smart) while texts
     * go out on the other (Globe), and Android still sends MMS on the second
     * by borrowing data for it. Checking the sending SIM refused those sends.
     * A switched-on SIM with no data service (no load, no signal) is caught by
     * [MMS_SEND_TIMEOUT_MS] instead.
     */
    @SuppressLint("MissingPermission") // READ_PHONE_STATE is requested in onboarding; failure assumes it's on
    private fun mobileDataOff(context: Context): Boolean =
        runCatching {
            val base = context.getSystemService(TelephonyManager::class.java) ?: return false
            val dataSub = SubscriptionManager.getDefaultDataSubscriptionId()
            val hasDataSim = dataSub != SubscriptionManager.INVALID_SUBSCRIPTION_ID
            val manager = if (hasDataSim) base.createForSubscriptionId(dataSub) else base
            !manager.isDataEnabled
        }.getOrDefault(false)

    // The carrier never answered: settled as failed so the bubble can be retried.
    private fun onTimeout(
        context: Context,
        rowId: Long,
        notice: Notice,
    ) {
        val box = MmsPersister.box(context, rowId)
        if (box != null && box != Telephony.Mms.MESSAGE_BOX_OUTBOX) return
        Log.w(TAG, "MMS $rowId got no answer in time; marking it failed")
        onResult(context, rowId, success = false, messageId = null, notice)
        mainHandler.post {
            Toast
                .makeText(context, R.string.mms_no_data_connection, Toast.LENGTH_LONG)
                .show()
        }
    }

    /** Where a failed send's notification points, and what it quotes. */
    class Notice(
        val conversationKey: String,
        val preview: String,
    )

    /** Called by MmsSentReceiver with the carrier's answer. */
    fun onResult(
        context: Context,
        rowId: Long,
        success: Boolean,
        messageId: String?,
        notice: Notice,
    ) {
        val box = if (success) Telephony.Mms.MESSAGE_BOX_SENT else Telephony.Mms.MESSAGE_BOX_FAILED
        MmsPersister.setBox(context, rowId, box, messageId)
        MmsReader.invalidate()
        context.contentResolver.notifyChange(Telephony.Mms.CONTENT_URI, null)
        val failureNotifId = NotificationHelper.failedSendNotifIdFor(notice.conversationKey)
        if (success) {
            NotificationHelper.cancel(context, failureNotifId)
        } else {
            Log.w(TAG, "MMS $rowId wasn't sent")
            NotificationHelper.sendFailedMessageNotification(
                context,
                notice.conversationKey,
                notice.preview,
                failureNotifId,
            )
        }
    }

    private fun dispatch(
        context: Context,
        req: SendReq,
        rowId: Long,
        subId: Int,
        notice: Notice,
    ) {
        val uri = MmsFileProvider.newUri(context)
        runCatching {
            val bytes = PduComposer(context, req).make() ?: error("Couldn't encode the MMS")
            context.contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                ?: error("Couldn't write the MMS file")
            val intent =
                Intent(context, MmsSentReceiver::class.java)
                    .putExtra(MmsSentReceiver.EXTRA_ROW_ID, rowId)
                    .putExtra(MmsSentReceiver.EXTRA_FILE_URI, uri.toString())
                    .putExtra(MmsSentReceiver.EXTRA_CONVERSATION, notice.conversationKey)
                    .putExtra(MmsSentReceiver.EXTRA_PREVIEW, notice.preview)
            // Mutable: the MMS service adds the carrier's reply to this intent.
            // Safe because the intent is explicit (our own receiver only).
            val flags =
                PendingIntent.FLAG_UPDATE_CURRENT or
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
            val sentIntent = PendingIntent.getBroadcast(context, rowId.toInt(), intent, flags)
            SmsSender.smsManagerFor(context, subId).sendMultimediaMessage(context, uri, null, null, sentIntent)
        }.onSuccess {
            val attempt = System.nanoTime()
            attempts[rowId] = attempt
            scope.launch {
                delay(MMS_SEND_TIMEOUT_MS)
                if (attempts.remove(rowId, attempt)) onTimeout(context, rowId, notice)
            }
        }.onFailure {
            Log.w(TAG, "Couldn't hand MMS $rowId to the phone", it)
            MmsFileProvider.delete(context, uri)
            onResult(context, rowId, success = false, messageId = null, notice)
        }
    }

    private fun preview(
        text: String,
        attachments: List<MmsAttachment>,
    ): String =
        text.ifBlank {
            when (attachments.size) {
                0 -> "Message"
                1 -> "Photo"
                else -> "${attachments.size} photos"
            }
        }
}
