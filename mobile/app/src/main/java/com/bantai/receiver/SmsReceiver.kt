package com.bantai.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import com.bantai.data.SmsIngestPipeline
import com.bantai.data.SmsRepository
import com.bantai.data.local.UserPreferences
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

private const val TAG = "SmsReceiver"

class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(
        context: Context,
        intent: Intent,
    ) {
        // Manifest registers SMS_DELIVER only (see AndroidManifest.xml comment) — this
        // guard just double-checks the action rather than assuming the caller is trusted.
        if (intent.action != Telephony.Sms.Intents.SMS_DELIVER_ACTION) return

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
        // locally when the backend is slow or unreachable. Row ids are kept so the
        // real classification can be attached to the right message once it's known.
        val insertedIds = mutableMapOf<String, Long>()
        if (isDefaultSmsApp) {
            for ((sender, bodyBuilder) in grouped) {
                val id = SmsIngestPipeline.storeMessage(context, sender, bodyBuilder.toString(), receivedAt, sentAt)
                if (id != null) insertedIds[sender] = id
            }
        }

        // Classification needs the network, which onReceive cannot wait on
        // inline. goAsync() keeps the receiver alive for the request; the system
        // kills it after roughly 10s, hence SmsApi's 5s timeout.
        val pendingResult = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                val token =
                    runCatching {
                        UserPreferences(context).userData.first().authToken
                    }.getOrDefault("")

                for ((sender, bodyBuilder) in grouped) {
                    SmsIngestPipeline.classifyAndNotify(
                        context = context,
                        repository = repository,
                        token = token,
                        sender = sender,
                        body = bodyBuilder.toString(),
                        receivedAt = receivedAt,
                        messageId = insertedIds[sender],
                    )
                }
            } catch (e: Exception) {
                Log.e(TAG, "Classification pass failed", e)
            } finally {
                pendingResult.finish()
            }
        }
    }

    // Strip whitespace, hyphens, and parentheses so that "+63 917-123-4567"
    // and "+639171234567" group as the same sender.
    private fun normalizeAddress(address: String?): String = (address ?: "Unknown").replace(Regex("[\\s\\-()]"), "")
}
