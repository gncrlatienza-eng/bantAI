package com.bantai.receiver

import android.content.BroadcastReceiver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import com.bantai.data.SmsRepository
import com.bantai.data.local.UserPreferences
import com.bantai.data.remote.SmsApi
import com.bantai.util.BlockHelper
import com.bantai.util.NotificationHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

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

        val receivedAt = System.currentTimeMillis()
        val sentAt = messages.first().timestampMillis

        // Persist to the inbox before any network work, so a message still lands
        // locally when the backend is slow or unreachable.
        if (isDefaultSmsApp) {
            for ((sender, bodyBuilder) in grouped) {
                storeMessage(context, sender, bodyBuilder.toString(), receivedAt, sentAt)
            }
        }

        // Classification needs the network, which onReceive cannot wait on
        // inline. goAsync() keeps the receiver alive for the request; the system
        // kills it after roughly 10s, hence SmsApi's 5s timeout.
        val pendingResult = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                val token = runCatching {
                    UserPreferences(context).userData.first().authToken
                }.getOrDefault("")

                for ((sender, bodyBuilder) in grouped) {
                    classifyAndNotify(
                        context = context,
                        repository = repository,
                        token = token,
                        sender = sender,
                        body = bodyBuilder.toString(),
                        receivedAt = receivedAt,
                    )
                }
            } catch (e: Exception) {
                Log.e(TAG, "Classification pass failed", e)
            } finally {
                pendingResult.finish()
            }
        }
    }

    private fun storeMessage(
        context: Context,
        sender: String,
        body: String,
        receivedAt: Long,
        sentAt: Long,
    ) {
        val values = ContentValues().apply {
            put(Telephony.Sms.ADDRESS, sender)
            put(Telephony.Sms.BODY, body)
            put(Telephony.Sms.DATE, receivedAt)
            put(Telephony.Sms.DATE_SENT, sentAt)
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

    /**
     * Classifies via the backend (which runs the fine-tuned model) and falls back
     * to the on-device heuristic whenever that is not possible — no stored token,
     * timeout, server error, or no connectivity. The fallback is deliberately
     * silent from the user's perspective: they still get the same alerts.
     */
    private suspend fun classifyAndNotify(
        context: Context,
        repository: SmsRepository,
        token: String,
        sender: String,
        body: String,
        receivedAt: Long,
    ) {
        // Notification ID: XOR of sender hash and truncated timestamp avoids
        // the collision caused by System.currentTimeMillis().toInt() overflow.
        val notifId = (sender.hashCode() xor (System.currentTimeMillis() ushr 10).toInt()) and Int.MAX_VALUE

        val result = if (token.isEmpty()) {
            Log.w(TAG, "No auth token stored — classifying $sender locally")
            null
        } else {
            SmsApi.ingest(token, sender, body, receivedAt)
                .onFailure { Log.w(TAG, "Backend ingest failed for $sender — classifying locally", it) }
                .getOrNull()
        }

        if (result != null) {
            applyBackendAction(context, result, sender, notifId)
        } else {
            applyLocalClassification(context, repository, sender, body, notifId)
        }
    }

    private fun applyBackendAction(
        context: Context,
        result: SmsApi.IngestResult,
        sender: String,
        notifId: Int,
    ) {
        // Sender was already blocked, so the backend did no work and the user has
        // already chosen not to hear from them.
        if (result.suppressed) return

        when (result.action) {
            SmsApi.Action.BLOCKED -> {
                BlockHelper.blockNumberSystem(context, sender)
                NotificationHelper.sendSmishingAlert(context, sender, notifId)
            }
            SmsApi.Action.ALERT -> {
                NotificationHelper.sendSuspiciousAlert(context, sender, notifId)
            }
            // INBOX — stored silently, no notification
            SmsApi.Action.INBOX -> Unit
        }
    }

    private fun applyLocalClassification(
        context: Context,
        repository: SmsRepository,
        sender: String,
        body: String,
        notifId: Int,
    ) {
        when (repository.classifyMessagePublic(sender, body)) {
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

    // Strip whitespace, hyphens, and parentheses so that "+63 917-123-4567"
    // and "+639171234567" group as the same sender.
    private fun normalizeAddress(address: String?): String =
        (address ?: "Unknown").replace(Regex("[\\s\\-()]"), "")
}
