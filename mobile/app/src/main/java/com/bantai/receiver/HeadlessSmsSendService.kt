package com.bantai.receiver

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.provider.Telephony
import android.util.Log
import com.bantai.data.SmsRepository
import com.bantai.util.SmsSender
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

private const val TAG = "HeadlessSmsSendService"

// TelephonyManager.ACTION_RESPOND_VIA_MESSAGE's literal value -- matches the action
// string AndroidManifest.xml's intent-filter for this service already declares.
// Using the literal directly rather than importing TelephonyManager just for this
// one constant.
private const val ACTION_RESPOND_VIA_MESSAGE = "android.intent.action.RESPOND_VIA_MESSAGE"

/**
 * Handles RESPOND_VIA_MESSAGE -- the "Reply" quick action offered by Android's
 * incoming-call screen (and equivalent surfaces such as Android Auto/Bluetooth),
 * declared in AndroidManifest.xml with the sms/smsto data schemes. Previously an
 * empty stub, so this silently did nothing at all: the system showed the quick-reply
 * option (BantAI being the default SMS app is what puts it there), but tapping it
 * never actually sent anything.
 *
 * The system only expects the message to be sent -- it doesn't wait for or display
 * a result itself -- so there is no UI here, only SmsSender plus a best-effort
 * Outbox record so the reply also shows up in the thread like any other sent
 * message.
 */
class HeadlessSmsSendService : Service() {
    // A Service has no natural coroutine scope of its own (unlike a ViewModel or a
    // Composable); this one is tied to the service instance and only ever used for
    // the one short-lived send this service exists to perform.
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(
        intent: Intent?,
        flags: Int,
        startId: Int,
    ): Int {
        if (intent == null || intent.action != ACTION_RESPOND_VIA_MESSAGE) {
            stopSelf(startId)
            return START_NOT_STICKY
        }

        // Same URI shape as the smsto: intents MainActivity.resolveComposeRequest
        // parses: the recipient is the scheme-specific part before any query string.
        val recipient =
            intent.data
                ?.schemeSpecificPart
                ?.substringBefore("?")
                ?.trim()
                .orEmpty()
        val body = intent.getStringExtra(Intent.EXTRA_TEXT)?.trim().orEmpty()
        if (recipient.isEmpty() || body.isEmpty()) {
            Log.w(TAG, "RESPOND_VIA_MESSAGE with no usable recipient/body")
            stopSelf(startId)
            return START_NOT_STICKY
        }

        val repo = SmsRepository(applicationContext)
        val isDefaultSmsApp = Telephony.Sms.getDefaultSmsPackage(applicationContext) == applicationContext.packageName
        scope.launch {
            // Only the default SMS app may write to the provider at all -- see
            // SmsReceiver's identical check. The reply still sends either way; it
            // just won't have a local Outbox row to show/update if this app somehow
            // isn't the default despite holding this permission.
            val outboxId = if (isDefaultSmsApp) repo.insertOutgoingMessage(recipient, body) else null
            SmsSender.send(applicationContext, recipient, body) { success, error ->
                if (outboxId != null) {
                    scope.launch {
                        repo.updateMessageType(
                            outboxId,
                            if (success) Telephony.Sms.MESSAGE_TYPE_SENT else Telephony.Sms.MESSAGE_TYPE_FAILED,
                        )
                    }
                }
                if (!success) Log.w(TAG, "Quick-reply send failed: $error")
                stopSelf(startId)
            }
        }
        return START_NOT_STICKY
    }
}
