package com.bantai

import android.content.Intent
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.mutableStateOf
import com.bantai.navigation.NavGraph
import com.bantai.ui.theme.BantAITheme
import com.bantai.util.NotificationHelper

// smsto:/sms: are the schemes Android's own Contacts and Dialer apps use for
// "Send message" / "Message" actions (ACTION_SENDTO with that data, or
// ACTION_SEND/ACTION_VIEW for the same intent shape from other apps) --
// matching the two AndroidManifest.xml already declares intent-filters for.
// MMS (mms:/mmsto:) is out of scope: this app doesn't compose or send MMS at
// all yet (see WapPushReceiver), so there's nowhere to route one to.
private val SMS_COMPOSE_ACTIONS = setOf(Intent.ACTION_SENDTO, Intent.ACTION_SEND, Intent.ACTION_VIEW)
private val SMS_COMPOSE_SCHEMES = setOf("sms", "smsto")

class MainActivity : ComponentActivity() {
    // Tab index requested by a notification tap (e.g. the Alerts tab), read by
    // NavGraph/MainScreen on both cold start and while already running.
    private val requestedTab = mutableStateOf<Int?>(null)

    // Set when a notification (e.g. a failed send) should jump straight into one
    // conversation thread rather than just a tab.
    private val requestedConversationSender = mutableStateOf<String?>(null)

    // Set when another app (Contacts, Dialer's "Message" action, or anything
    // else sending an sms:/smsto: intent) asks to compose a message to a
    // specific number. Previously unhandled entirely -- BantAI is a default-SMS
    // -app candidate, and every other messaging app on Android honors this
    // intent shape; without it, tapping "Message" for a contact just opened
    // BantAI's Inbox with no indication of who to message.
    private val requestedComposeRecipient = mutableStateOf<String?>(null)
    private val requestedComposeBody = mutableStateOf("")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // The whole app renders SMS content (including forwarded OTPs) and, on the
        // OTP-entry screen, the code itself — FLAG_SECURE blocks screenshots, screen
        // recording, and the Recents/App-Switcher thumbnail for the entire window.
        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        // Tapjacking protection: Compose has no reliable per-composable equivalent
        // to View.filterTouchesWhenObscured, so it's set on the decor view instead —
        // covers every screen (OTP entry included) rather than just one.
        window.decorView.filterTouchesWhenObscured = true
        enableEdgeToEdge()
        NotificationHelper.createNotificationChannels(this)
        applyIntent(intent)
        setContent {
            BantAITheme {
                NavGraph(
                    requestedTab = requestedTab.value,
                    requestedConversationSender = requestedConversationSender.value,
                    requestedComposeRecipient = requestedComposeRecipient.value,
                    requestedComposeBody = requestedComposeBody.value,
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        applyIntent(intent)
    }

    private fun applyIntent(intent: Intent) {
        requestedTab.value = resolveTabIndex(intent)
        requestedConversationSender.value = intent.getStringExtra(NotificationHelper.EXTRA_CONVERSATION_SENDER)
        val compose = resolveComposeRequest(intent)
        requestedComposeRecipient.value = compose?.first
        requestedComposeBody.value = compose?.second.orEmpty()
    }

    private fun resolveTabIndex(intent: Intent): Int? =
        when (intent.getStringExtra(NotificationHelper.EXTRA_NAVIGATE_TO)) {
            NotificationHelper.TARGET_MESSAGES -> 0
            NotificationHelper.TARGET_ALERTS -> 1
            else -> null
        }

    // The recipient sits in the URI's scheme-specific part ("smsto:5551234567",
    // optionally "?body=..." after it, per the same convention SmsTo intents use
    // across every SMS app on Android); the message body more commonly arrives
    // as the non-standard but widely-supported "sms_body" extra (used by the
    // Dialer/Contacts "Message" actions) or, for a generic ACTION_SEND share, as
    // the standard EXTRA_TEXT.
    private fun resolveComposeRequest(intent: Intent): Pair<String, String>? {
        if (intent.action !in SMS_COMPOSE_ACTIONS) return null
        val data = intent.data ?: return null
        if (data.scheme?.lowercase() !in SMS_COMPOSE_SCHEMES) return null
        val recipient =
            data.schemeSpecificPart
                ?.substringBefore("?")
                ?.trim()
                .orEmpty()
        if (recipient.isEmpty()) return null
        val body = intent.getStringExtra("sms_body") ?: intent.getStringExtra(Intent.EXTRA_TEXT).orEmpty()
        return recipient to body
    }
}
