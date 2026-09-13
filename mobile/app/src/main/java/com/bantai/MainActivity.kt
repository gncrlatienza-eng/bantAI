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

class MainActivity : ComponentActivity() {
    // Tab index requested by a notification tap (e.g. the Alerts tab), read by
    // NavGraph/MainScreen on both cold start and while already running.
    private val requestedTab = mutableStateOf<Int?>(null)

    // Set when a notification (e.g. a failed send) should jump straight into one
    // conversation thread rather than just a tab.
    private val requestedConversationSender = mutableStateOf<String?>(null)

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
        requestedTab.value = resolveTabIndex(intent)
        requestedConversationSender.value = intent.getStringExtra(NotificationHelper.EXTRA_CONVERSATION_SENDER)
        setContent {
            BantAITheme {
                NavGraph(
                    requestedTab = requestedTab.value,
                    requestedConversationSender = requestedConversationSender.value,
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        requestedTab.value = resolveTabIndex(intent)
        requestedConversationSender.value = intent.getStringExtra(NotificationHelper.EXTRA_CONVERSATION_SENDER)
    }

    private fun resolveTabIndex(intent: Intent): Int? =
        when (intent.getStringExtra(NotificationHelper.EXTRA_NAVIGATE_TO)) {
            NotificationHelper.TARGET_MESSAGES -> 0
            NotificationHelper.TARGET_ALERTS -> 1
            else -> null
        }
}
