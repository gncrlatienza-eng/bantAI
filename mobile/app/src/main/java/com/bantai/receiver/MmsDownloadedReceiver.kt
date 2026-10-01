package com.bantai.receiver

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.bantai.container
import com.bantai.data.MMS_ID_OFFSET
import com.bantai.data.SmsIngestPipeline
import com.bantai.data.model.groupKey
import com.bantai.mms.MmsDownloader
import com.bantai.mms.MmsFileProvider
import com.bantai.mms.MmsParticipants
import com.bantai.mms.MmsPersister
import com.bantai.mms.PersistedMms
import com.bantai.mms.pdu.PduHeaders
import com.bantai.mms.pdu.PduParser
import com.bantai.mms.pdu.RetrieveConf
import com.bantai.util.NotificationHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

private const val TAG = "MmsDownloadedReceiver"

/**
 * The result of an MMS download MmsDownloader started. On success the MMS is
 * saved to the phone's message store, run through the same scam check as an SMS
 * (text only -- photos never leave the phone), and notified. On failure the
 * thread keeps a "Tap to download" bubble and the user is told.
 * Not exported: only reached through MmsDownloader's own PendingIntent.
 */
@Suppress("TooGenericExceptionCaught") // provider/parser throw anything; the pending row must still settle
class MmsDownloadedReceiver : BroadcastReceiver() {
    override fun onReceive(
        context: Context,
        intent: Intent,
    ) {
        val pendingId = intent.getLongExtra(EXTRA_PENDING_ID, -1)
        val fileUri = MmsDownloader.uriFrom(intent.getStringExtra(EXTRA_FILE_URI))
        if (pendingId < 0 || fileUri == null) return
        val result = resultCode
        val succeeded = result == Activity.RESULT_OK

        val pendingResult = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            val downloader = context.container.mmsDownloader
            try {
                val row = downloader.get(pendingId) ?: return@launch
                val conf =
                    if (succeeded) {
                        MmsFileProvider
                            .readBytes(context, fileUri)
                            ?.takeIf { it.isNotEmpty() }
                            ?.let { runCatching { PduParser(it, true).parse() }.getOrNull() } as? RetrieveConf
                    } else {
                        null
                    }
                // 0 = the carrier left the status out, which means OK.
                val retrieved = conf?.takeIf { it.retrieveStatus in setOf(0, PduHeaders.RETRIEVE_STATUS_OK) }
                val saved =
                    retrieved?.let {
                        MmsPersister.persist(context, it, row.subId, row.receivedAt, row.contentLocation)
                    }
                if (saved == null) {
                    Log.w(TAG, "MMS download failed (result=$result, parsed=${conf != null})")
                    downloader.markFailed(pendingId)
                    NotificationHelper.sendMmsDownloadFailedNotification(context, row.sender)
                    return@launch
                }
                downloader.complete(pendingId)
                downloader.acknowledge(row.transactionId, row.subId)
                notify(context, saved, row.receivedAt)
            } catch (e: Exception) {
                Log.e(TAG, "Handling a downloaded MMS failed", e)
                runCatching { downloader.markFailed(pendingId) }
            } finally {
                MmsFileProvider.delete(context, fileUri)
                pendingResult.finish()
            }
        }
    }

    // The MMS's text gets the same masked scam check as an SMS. A photo with no
    // text has nothing the classifier can read, so it's a plain notification.
    private suspend fun notify(
        context: Context,
        saved: PersistedMms,
        receivedAt: Long,
    ) {
        val messageId = MMS_ID_OFFSET + saved.rowId
        val conversation = if (MmsParticipants.isGroup(saved.others)) groupKey(saved.threadId) else saved.sender
        if (saved.text.isBlank()) {
            NotificationHelper.sendMessageNotification(context, saved.sender, preview(saved), 0, conversation)
            return
        }
        val token =
            runCatching {
                context.container.userPreferences.userData
                    .first()
                    .authToken
            }.getOrDefault("")
        SmsIngestPipeline.classifyAndNotify(
            context,
            token,
            saved.sender,
            saved.text,
            receivedAt,
            messageId,
            conversationKey = conversation,
        )
    }

    private fun preview(saved: PersistedMms): String =
        when {
            saved.imageCount == 1 -> "Photo"
            saved.imageCount > 1 -> "${saved.imageCount} photos"
            saved.otherAttachments > 0 -> "Attachment"
            else -> "Picture message"
        }

    companion object {
        const val EXTRA_PENDING_ID = "com.bantai.extra.PENDING_MMS_ID"
        const val EXTRA_FILE_URI = "com.bantai.extra.MMS_FILE_URI"
    }
}
