package com.bantai

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.lifecycle.lifecycleScope
import com.bantai.data.DailySummaryScheduler
import com.bantai.data.ReportStatusWorker
import com.bantai.data.RetentionWorker
import com.bantai.data.TipCheckWorker
import com.bantai.data.offline.HistorySortWorker
import com.bantai.navigation.NavGraph
import com.bantai.navigation.RequestedTip
import com.bantai.ui.components.CoachMarkHost
import com.bantai.ui.components.LaunchScreen
import com.bantai.ui.theme.BantAITheme
import com.bantai.ui.theme.TextScale
import com.bantai.ui.theme.ThemeMode
import com.bantai.ui.theme.isDark
import com.bantai.util.IntentToken
import com.bantai.util.NotificationHelper
import com.bantai.util.NotificationLanding
import kotlinx.coroutines.launch

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

    // Set when a safety-tip notification is tapped: the tip, and the Scam Wave
    // it belongs to when it's a campaign tip.
    private val requestedTip = mutableStateOf<RequestedTip?>(null)
    private val requestedComposeBody = mutableStateOf("")
    private val requestedSummary = mutableStateOf<Long?>(null)

    // Opening (or returning to) the app after the summary time, with nothing shown
    // yet today: the recap card opens right away instead of waiting on a
    // notification the phone's battery manager may have held back.
    override fun onResume() {
        super.onResume()
        lifecycleScope.launch {
            if (DailySummaryScheduler.claimIfDue(this@MainActivity)) {
                requestedSummary.value = System.currentTimeMillis()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Screenshots are allowed: users screenshot scam texts to report or warn
        // others. Only the sign-in code screen sets FLAG_SECURE (see
        // OnboardingEnterCodeScreen), so BantAI's own OTP can't be captured.
        // Tapjacking protection: Compose has no reliable per-composable equivalent
        // to View.filterTouchesWhenObscured, so it's set on the decor view instead —
        // covers every screen (OTP entry included) rather than just one.
        window.decorView.filterTouchesWhenObscured = true
        enableEdgeToEdge()
        NotificationHelper.createNotificationChannels(this)
        TipCheckWorker.schedule(this)
        ReportStatusWorker.schedule(this)
        RetentionWorker.schedule(this)
        lifecycleScope.launch { DailySummaryScheduler.schedule(this@MainActivity) }
        // Resumes the background half of first-run sorting after a restart.
        HistorySortWorker.enqueue(this)
        // Only a fresh launch: a recreation (dark mode, font size) used to replay
        // the old notification intent and reopen its card or screen.
        if (savedInstanceState == null) applyIntent(intent)
        val themeModeFlow = this.container.userPreferences.themeMode
        val textScaleFlow = this.container.userPreferences.textScale
        setContent {
            // Not gated like the theme: default size is a fine first frame.
            val storedTextScale by textScaleFlow.collectAsState(initial = "")
            // Until the stored theme choice is read (one small DataStore read),
            // show the launch screen -- the same logo frame as the launch window
            // (res/drawable/launch_background.xml) -- rather than a blank screen.
            val storedMode by themeModeFlow.collectAsState(initial = null)
            val mode =
                storedMode ?: run {
                    LaunchScreen()
                    return@setContent
                }
            val dark = ThemeMode.fromValue(mode).isDark()
            // Status/navigation bar icons follow the app's theme, not the system's.
            DisposableEffect(dark) {
                val style = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT) { dark }
                enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
                onDispose {}
            }
            BantAITheme(
                darkTheme = dark,
                textScale = TextScale.fromValue(storedTextScale).factor,
            ) {
                CoachMarkHost {
                    NavGraph(
                        requestedTab = requestedTab.value,
                        requestedConversationSender = requestedConversationSender.value,
                        requestedTip = requestedTip.value,
                        requestedComposeRecipient = requestedComposeRecipient.value,
                        requestedComposeBody = requestedComposeBody.value,
                        requestedSummary = requestedSummary.value,
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        applyIntent(intent)
    }

    private fun applyIntent(intent: Intent) {
        // Tab / conversation extras only count when they come from BantAI's own
        // notifications (they carry IntentToken). This activity is open to other
        // apps for "send SMS" links, and any app could otherwise add these
        // extras to jump BantAI into a conversation of its choosing.
        val trusted = IntentToken.isTrusted(this, intent.getStringExtra(IntentToken.EXTRA))
        requestedTab.value = if (trusted) resolveTabIndex(intent) else null
        requestedConversationSender.value =
            if (trusted) intent.getStringExtra(NotificationHelper.EXTRA_CONVERSATION_SENDER) else null
        requestedTip.value =
            intent
                .getStringExtra(NotificationHelper.EXTRA_TIP_ID)
                ?.takeIf { trusted }
                ?.let { RequestedTip(it, intent.getStringExtra(NotificationHelper.EXTRA_TIP_WAVE_KEY)) }
        if (trusted) NotificationLanding.pending.value = intent.getStringExtra(NotificationHelper.EXTRA_LANDING)
        val target = intent.getStringExtra(NotificationHelper.EXTRA_NAVIGATE_TO)
        if (trusted && target == NotificationHelper.TARGET_DAILY_SUMMARY) {
            requestedSummary.value = System.currentTimeMillis()
        }
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
