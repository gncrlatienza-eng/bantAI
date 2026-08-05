package com.bantai.util

import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.telephony.SmsManager
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

private val requestCodeCounter = AtomicInteger(0)

// If the carrier/radio never fires the sentIntent at all (seen on some devices/OEM
// firmware in degraded radio states), the UI would otherwise show "Sending…"
// forever with no way to know it failed. This bounds that wait.
private const val SEND_TIMEOUT_MS = 20_000L

/**
 * SmsManager.sendTextMessage() returning just means "handed to the radio" — without
 * a sentIntent the app has no idea whether the carrier actually accepted it. No
 * signal, airplane mode, and a generic radio failure all otherwise look identical
 * to a successful send. This wraps send with a real result callback.
 *
 * Note: a prepaid SIM with no load/balance is usually NOT distinguishable from
 * success at this level — that rejection happens at the carrier's SMSC, which is
 * invisible to the sending device, so onResult(true, null) can still fire even
 * when the message never actually reached anyone for a billing reason.
 */
object SmsSender {

    @Suppress("DEPRECATION")
    fun send(context: Context, to: String, body: String, onResult: (success: Boolean, error: String?) -> Unit) {
        val appContext = context.applicationContext
        val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            appContext.getSystemService(SmsManager::class.java) ?: SmsManager.getDefault()
        } else {
            SmsManager.getDefault()
        }

        val parts = smsManager.divideMessage(body)
        val action = "com.bantai.SMS_SENT_${requestCodeCounter.incrementAndGet()}_${System.currentTimeMillis()}"
        var pending = parts.size
        var firstError: String? = null
        val settled = AtomicBoolean(false)
        val handler = Handler(Looper.getMainLooper())

        lateinit var receiver: BroadcastReceiver
        val finish = { success: Boolean, error: String? ->
            if (settled.compareAndSet(false, true)) {
                handler.removeCallbacksAndMessages(null)
                try {
                    appContext.unregisterReceiver(receiver)
                } catch (_: Exception) {
                }
                onResult(success, error)
            }
        }

        receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                val error = describeResult(resultCode)
                if (error != null && firstError == null) firstError = error
                pending--
                if (pending <= 0) finish(firstError == null, firstError)
            }
        }

        val filter = IntentFilter(action)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            appContext.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            appContext.registerReceiver(receiver, filter)
        }
        handler.postDelayed({ finish(false, "Message failed to send") }, SEND_TIMEOUT_MS)

        val sentIntents = ArrayList<PendingIntent>(parts.size)
        repeat(parts.size) {
            sentIntents.add(
                PendingIntent.getBroadcast(
                    appContext,
                    requestCodeCounter.incrementAndGet(),
                    Intent(action).setPackage(appContext.packageName),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
            )
        }

        if (parts.size == 1) {
            smsManager.sendTextMessage(to, null, body, sentIntents[0], null)
        } else {
            smsManager.sendMultipartTextMessage(to, null, parts, sentIntents, null)
        }
    }

    private fun describeResult(resultCode: Int): String? = when (resultCode) {
        Activity.RESULT_OK -> null
        SmsManager.RESULT_ERROR_NO_SERVICE -> "No signal — message not sent"
        SmsManager.RESULT_ERROR_RADIO_OFF -> "Airplane mode is on — message not sent"
        SmsManager.RESULT_ERROR_NULL_PDU -> "Message could not be sent"
        SmsManager.RESULT_ERROR_GENERIC_FAILURE -> "Message failed to send"
        else -> "Message failed to send"
    }
}
