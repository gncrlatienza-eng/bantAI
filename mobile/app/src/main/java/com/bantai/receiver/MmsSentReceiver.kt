package com.bantai.receiver

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import com.bantai.mms.MmsFileProvider
import com.bantai.mms.MmsSender
import com.bantai.mms.pdu.PduHeaders
import com.bantai.mms.pdu.PduParser
import com.bantai.mms.pdu.SendConf
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

private const val TAG = "MmsSentReceiver"

// SmsManager.EXTRA_MMS_DATA: the carrier's m-send-conf.
private const val EXTRA_MMS_DATA = "android.telephony.extra.MMS_DATA"

/**
 * The result of an MMS MmsSender handed to the phone. Registered in the
 * manifest (not at runtime like SmsSender's), so the result still lands if
 * BantAI was closed while a slow MMS upload finished. Not exported: only
 * reached through MmsSender's own PendingIntent.
 */
@Suppress("TooGenericExceptionCaught") // a bad reply PDU must still settle the bubble
class MmsSentReceiver : BroadcastReceiver() {
    override fun onReceive(
        context: Context,
        intent: Intent,
    ) {
        val rowId = intent.getLongExtra(EXTRA_ROW_ID, -1)
        val fileUri = intent.getStringExtra(EXTRA_FILE_URI)
        val conversation = intent.getStringExtra(EXTRA_CONVERSATION).orEmpty()
        val preview = intent.getStringExtra(EXTRA_PREVIEW).orEmpty()
        if (rowId < 0) return
        val result = resultCode
        val handedOff = result == Activity.RESULT_OK
        val reply = intent.getByteArrayExtra(EXTRA_MMS_DATA)

        val pendingResult = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                val conf = reply?.let { runCatching { PduParser(it, true).parse() }.getOrNull() } as? SendConf
                // No reply at all still counts: some phones don't pass it on.
                val accepted = handedOff && (conf == null || conf.responseStatus == PduHeaders.RESPONSE_STATUS_OK)
                val messageId = conf?.messageId?.let { String(it, Charsets.ISO_8859_1) }
                if (!accepted) Log.w(TAG, "MMS not sent (result=$result, status=${conf?.responseStatus})")
                MmsSender.onResult(context, rowId, accepted, messageId, MmsSender.Notice(conversation, preview))
            } catch (e: Exception) {
                Log.e(TAG, "Handling an MMS send result failed", e)
            } finally {
                fileUri?.let { MmsFileProvider.delete(context, Uri.parse(it)) }
                pendingResult.finish()
            }
        }
    }

    companion object {
        const val EXTRA_ROW_ID = "com.bantai.extra.MMS_ROW_ID"
        const val EXTRA_FILE_URI = "com.bantai.extra.MMS_FILE_URI"
        const val EXTRA_CONVERSATION = "com.bantai.extra.MMS_CONVERSATION"
        const val EXTRA_PREVIEW = "com.bantai.extra.MMS_PREVIEW"
    }
}
