package com.bantai.util

import android.annotation.SuppressLint
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
import android.telephony.SubscriptionManager
import com.bantai.receiver.DeliveryReceiver
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

private val requestCodeCounter = AtomicInteger(0)

// Pre-API-33 has no RECEIVER_NOT_EXPORTED equivalent for dynamic receivers, so
// without this, any app on the device could forge a broadcast matching the
// per-send action below and spoof a fake "sent successfully" result. A
// signature-level permission (declared in AndroidManifest.xml) closes that —
// only an app signed with the same key can hold it, and PendingIntent.send()
// from the telephony service still carries our own app's identity, so the real
// result delivery is unaffected.
private const val SEND_RESULT_PERMISSION = "com.bantai.permission.SMS_SEND_RESULT"

// If the carrier/radio never fires the sentIntent at all (seen on some devices/OEM
// firmware in degraded radio states), the UI would otherwise show "Sending…"
// forever with no way to know it failed. This bounds that wait.
private const val SEND_TIMEOUT_MS = 20_000L

// After that timeout the result can still arrive (slow network). The receiver
// stays registered this much longer so a late "sent" can correct the failure.
private const val LATE_RESULT_WINDOW_MS = 120_000L

/**
 * SmsManager.sendTextMessage() returning just means "handed to the radio" — without
 * a sentIntent the app has no idea whether the carrier actually accepted it. No
 * signal, airplane mode, and a generic radio failure all otherwise look identical
 * to a successful send. This wraps send with a real result callback.
 *
 * [onResult] normally fires once. The one exception: when the 20s timeout has
 * already reported a failure and the carrier then confirms the send, it fires a
 * second time with success -- a message that did go out used to stay "Not
 * delivered", and retrying it sent it twice.
 *
 * Note: a prepaid SIM with no load/balance is usually NOT distinguishable from
 * success at this level — that rejection happens at the carrier's SMSC, which is
 * invisible to the sending device, so onResult(true, null) can still fire even
 * when the message never actually reached anyone for a billing reason.
 */
object SmsSender {
    @Suppress("LongMethod", "LongParameterList") // one value per piece of the send
    fun send(
        context: Context,
        to: String,
        body: String,
        subId: Int = -1,
        // The stored row to mark "Delivered"; null asks for no delivery report.
        deliveryRowId: Long? = null,
        onResult: (success: Boolean, error: String?) -> Unit,
    ) {
        val appContext = context.applicationContext
        val smsManager = smsManagerFor(appContext, subId)

        val parts = smsManager.divideMessage(body)
        val action = "com.bantai.SMS_SENT_${requestCodeCounter.incrementAndGet()}_${System.currentTimeMillis()}"
        var pending = parts.size
        var firstError: String? = null
        val settled = AtomicBoolean(false)
        val timedOut = AtomicBoolean(false)
        val handler = Handler(Looper.getMainLooper())

        lateinit var receiver: BroadcastReceiver
        val unregister = {
            handler.removeCallbacksAndMessages(null)
            try {
                appContext.unregisterReceiver(receiver)
            } catch (_: Exception) {
            }
        }

        receiver =
            object : BroadcastReceiver() {
                override fun onReceive(
                    ctx: Context,
                    intent: Intent,
                ) {
                    val error = describeResult(resultCode)
                    if (error != null && firstError == null) firstError = error
                    pending--
                    if (pending > 0) return
                    unregister()
                    if (settled.compareAndSet(false, true)) {
                        onResult(firstError == null, firstError)
                    } else if (timedOut.get() && firstError == null) {
                        // The timeout already reported a failure; this is the real outcome.
                        onResult(true, null)
                    }
                }
            }

        val filter = IntentFilter(action)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            appContext.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            appContext.registerReceiver(receiver, filter, SEND_RESULT_PERMISSION, null)
        }
        handler.postDelayed({
            if (settled.compareAndSet(false, true)) {
                timedOut.set(true)
                onResult(false, "Message failed to send")
                handler.postDelayed(unregister, LATE_RESULT_WINDOW_MS)
            }
        }, SEND_TIMEOUT_MS)

        val sentIntents = ArrayList<PendingIntent>(parts.size)
        repeat(parts.size) {
            sentIntents.add(
                PendingIntent.getBroadcast(
                    appContext,
                    requestCodeCounter.incrementAndGet(),
                    Intent(action).setPackage(appContext.packageName),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                ),
            )
        }

        // One report, for the last part: the message counts as delivered when
        // its end arrives (and a report per part would mean one each).
        val deliveryIntents =
            deliveryRowId?.let { rowId ->
                List(parts.size) { i -> if (i == parts.lastIndex) deliveryIntent(appContext, rowId) else null }
            }
        if (parts.size == 1) {
            smsManager.sendTextMessage(to, null, body, sentIntents[0], deliveryIntents?.get(0))
        } else {
            smsManager.sendMultipartTextMessage(to, null, parts, sentIntents, deliveryIntents?.let(::ArrayList))
        }
    }

    // The SIM the conversation came in on, when it's still in the phone (dual-SIM
    // phones used to always reply from the default SIM); otherwise the phone's
    // default SMS SIM, or its only SIM.
    @Suppress("DEPRECATION")
    internal fun smsManagerFor(
        context: Context,
        subId: Int,
    ): SmsManager {
        val base =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                context.getSystemService(SmsManager::class.java) ?: SmsManager.getDefault()
            } else {
                SmsManager.getDefault()
            }
        val target = usableSubId(context, subId) ?: return base
        return runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                base.createForSubscriptionId(target)
            } else {
                SmsManager.getSmsManagerForSubscriptionId(target)
            }
        }.getOrDefault(base)
    }

    // A thread's old messages can carry the id of a SIM that has since been
    // removed. Sending on it makes Android open its own SIM picker, which on
    // some phones (Huawei VOG-L29) fails at once -- the send "failed" instantly
    // and the picker briefly covered BantAI. Only active SIMs are used here.
    // Null leaves the choice to Android (several SIMs, none set for SMS).
    @SuppressLint("MissingPermission") // READ_PHONE_STATE is requested in onboarding; failure falls back to null
    internal fun usableSubId(
        context: Context,
        preferred: Int,
    ): Int? {
        val active =
            runCatching {
                context
                    .getSystemService(SubscriptionManager::class.java)
                    ?.activeSubscriptionInfoList
                    ?.map { it.subscriptionId }
            }.getOrNull().orEmpty()
        val default = SubscriptionManager.getDefaultSmsSubscriptionId()
        return when {
            preferred >= 0 && (active.isEmpty() || preferred in active) -> preferred
            default != SubscriptionManager.INVALID_SUBSCRIPTION_ID && (active.isEmpty() || default in active) -> default
            active.size == 1 -> active.single()
            else -> null
        }
    }

    // Mutable: the radio adds the report itself to this intent. Safe because
    // the intent is explicit (our own receiver only).
    private fun deliveryIntent(
        context: Context,
        rowId: Long,
    ): PendingIntent {
        val intent =
            Intent(context, DeliveryReceiver::class.java).putExtra(DeliveryReceiver.EXTRA_ROW_ID, rowId)
        val flags =
            PendingIntent.FLAG_UPDATE_CURRENT or
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
        return PendingIntent.getBroadcast(context, rowId.toInt(), intent, flags)
    }

    private fun describeResult(resultCode: Int): String? =
        when (resultCode) {
            Activity.RESULT_OK -> null
            SmsManager.RESULT_ERROR_NO_SERVICE -> "No signal — message not sent"
            SmsManager.RESULT_ERROR_RADIO_OFF -> "Airplane mode is on — message not sent"
            SmsManager.RESULT_ERROR_NULL_PDU -> "Message could not be sent"
            SmsManager.RESULT_ERROR_GENERIC_FAILURE -> "Message failed to send"
            else -> "Message failed to send"
        }
}
