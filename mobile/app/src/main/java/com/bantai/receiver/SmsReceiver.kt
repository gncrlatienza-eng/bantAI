package com.bantai.receiver

import android.content.BroadcastReceiver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import com.bantai.data.SmsRepository
import com.bantai.util.BlockHelper
import com.bantai.util.NotificationHelper

private const val TAG = "SmsReceiver"

class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION &&
            intent.action != "android.provider.Telephony.SMS_DELIVER") return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        val repository = SmsRepository(context)

        // Only the default SMS app may write to the SMS ContentProvider (Android 4.4+).
        val isDefaultSmsApp = Telephony.Sms.getDefaultSmsPackage(context) == context.packageName

        // Group multipart SMS by normalised sender address so parts from the same
        // sender are always assembled into one message regardless of address format.
        val grouped = mutableMapOf<String, StringBuilder>()
        for (msg in messages) {
            val sender = normalizeAddress(msg.displayOriginatingAddress)
            grouped.getOrPut(sender) { StringBuilder() }.append(msg.messageBody)
        }

        for ((sender, bodyBuilder) in grouped) {
            val body = bodyBuilder.toString()

            // Write to the SMS ContentProvider only when we are the default SMS app.
            if (isDefaultSmsApp) {
                val values = ContentValues().apply {
                    put(Telephony.Sms.ADDRESS, sender)
                    put(Telephony.Sms.BODY, body)
                    put(Telephony.Sms.DATE, System.currentTimeMillis())
                    put(Telephony.Sms.DATE_SENT, messages.first().timestampMillis)
                    put(Telephony.Sms.READ, 0)
                    put(Telephony.Sms.SEEN, 0)
                    put(Telephony.Sms.STATUS, Telephony.Sms.STATUS_NONE)
                    put(Telephony.Sms.TYPE, Telephony.Sms.MESSAGE_TYPE_INBOX)
                }
                try {
                    context.contentResolver.insert(Telephony.Sms.Inbox.CONTENT_URI, values)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to insert message from $sender", e)
                }
            }

            // Classify and notify regardless of default-app status.
            val classification = repository.classifyMessagePublic(sender, body)

            // Notification ID: XOR of sender hash and truncated timestamp avoids
            // the collision caused by System.currentTimeMillis().toInt() overflow.
            val notifId = (sender.hashCode() xor (System.currentTimeMillis() ushr 10).toInt()) and Int.MAX_VALUE

            when (classification) {
                "suspicious" -> {
                    BlockHelper.blockNumberSystem(context, sender)
                    NotificationHelper.sendSmishingAlert(context, sender, notifId)
                }
                "unknown" -> {
                    NotificationHelper.sendSuspiciousAlert(context, sender, notifId)
                }
                // "safe" — stored silently, no notification
            }
        }
    }

    // Strip whitespace, hyphens, and parentheses so that "+63 917-123-4567"
    // and "+639171234567" group as the same sender.
    private fun normalizeAddress(address: String?): String =
        (address ?: "Unknown").replace(Regex("[\\s\\-()]"), "")
}
