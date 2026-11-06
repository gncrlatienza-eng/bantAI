package com.bantai.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.telephony.SmsMessage
import android.util.Log
import com.bantai.container
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

private const val TAG = "DeliveryReceiver"

/**
 * Maps a delivery report's status (TP-Status, 3GPP 23.040) to the SMS
 * provider's STATUS column. The provider's own constants line up with the
 * TP-Status ranges: 0x00-0x1F delivered, 0x20-0x3F still trying, 0x40+ failed.
 */
fun deliveryStatusFor(reportStatus: Int): Int =
    when {
        reportStatus >= Telephony.Sms.STATUS_FAILED -> Telephony.Sms.STATUS_FAILED
        reportStatus >= Telephony.Sms.STATUS_PENDING -> Telephony.Sms.STATUS_PENDING
        else -> Telephony.Sms.STATUS_COMPLETE
    }

/**
 * The carrier's delivery report for a sent SMS (only requested when the user
 * turned on Settings → Notifications → Delivery reports). Records it on the
 * message's row, so the thread can show "Delivered". Not exported: only
 * reached through SmsSender's own PendingIntent.
 */
@Suppress("TooGenericExceptionCaught") // a malformed report or provider error must not crash the receiver
class DeliveryReceiver : BroadcastReceiver() {
    override fun onReceive(
        context: Context,
        intent: Intent,
    ) {
        val rowId = intent.getLongExtra(EXTRA_ROW_ID, -1)
        val pdu = intent.getByteArrayExtra("pdu")
        if (rowId <= 0 || pdu == null) return
        val format = intent.getStringExtra("format")
        val report = runCatching { SmsMessage.createFromPdu(pdu, format) }.getOrNull() ?: return
        val status = deliveryStatusFor(report.status)

        val pendingResult = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                context.container.smsWriter.updateDeliveryStatus(rowId, status)
            } catch (e: Exception) {
                Log.e(TAG, "Couldn't record delivery report for $rowId", e)
            } finally {
                pendingResult.finish()
            }
        }
    }

    companion object {
        const val EXTRA_ROW_ID = "com.bantai.extra.DELIVERY_ROW_ID"
    }
}
