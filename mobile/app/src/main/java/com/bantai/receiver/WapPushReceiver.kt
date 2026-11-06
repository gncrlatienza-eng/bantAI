package com.bantai.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import com.bantai.container
import com.bantai.mms.MmsParticipants
import com.bantai.mms.pdu.NotificationInd
import com.bantai.mms.pdu.PduParser
import com.bantai.util.BlockHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

private const val TAG = "WapPushReceiver"

// SubscriptionManager.EXTRA_SUBSCRIPTION_INDEX, and the older name some OEMs still use.
private const val EXTRA_SUBSCRIPTION_INDEX = "android.telephony.extra.SUBSCRIPTION_INDEX"
private const val EXTRA_SUBSCRIPTION_LEGACY = "subscription"

/**
 * The carrier announcing an incoming MMS (picture message, group text). The
 * announcement only says who it's from and where to fetch it; MmsDownloader
 * fetches it and MmsDownloadedReceiver saves it. Android sends this broadcast
 * to the default SMS app only, so as default app nobody else would ever
 * download it -- before this, every MMS was lost.
 */
@Suppress("TooGenericExceptionCaught") // a bad PDU or provider error must not crash the receiver
class WapPushReceiver : BroadcastReceiver() {
    override fun onReceive(
        context: Context,
        intent: Intent,
    ) {
        if (intent.action != Telephony.Sms.Intents.WAP_PUSH_DELIVER_ACTION) return
        val data = intent.getByteArrayExtra("data") ?: return
        val subId = intent.getIntExtra(EXTRA_SUBSCRIPTION_INDEX, intent.getIntExtra(EXTRA_SUBSCRIPTION_LEGACY, -1))
        val receivedAt = System.currentTimeMillis()

        // Room and the provider are blocking; onReceive only has the short ANR budget.
        val pendingResult = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                val pdu = runCatching { PduParser(data, true).parse() }.getOrNull()
                if (pdu !is NotificationInd) {
                    // Delivery and read reports arrive here too; nothing to download.
                    Log.i(TAG, "Ignoring WAP push that isn't an MMS notification (${pdu?.messageType})")
                    return@launch
                }
                val sender = MmsParticipants.clean(pdu.from?.string)
                if (sender != null && isBlocked(context, sender)) {
                    Log.i(TAG, "Dropping MMS from a blocked sender")
                    return@launch
                }
                context.container.mmsDownloader.enqueue(pdu, subId, receivedAt)
            } catch (e: Exception) {
                Log.e(TAG, "Couldn't handle incoming MMS notification", e)
            } finally {
                pendingResult.finish()
            }
        }
    }

    private suspend fun isBlocked(
        context: Context,
        sender: String,
    ): Boolean =
        runCatching {
            val blocked =
                context.container.blockedSendersStore
                    .current()
                    .blocked
            BlockHelper.isSenderBlocked(context, sender, blocked)
        }.getOrDefault(false)
}
