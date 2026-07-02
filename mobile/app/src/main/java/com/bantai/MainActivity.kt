package com.bantai

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.bantai.navigation.NavGraph
import com.bantai.ui.theme.BantAITheme
import com.bantai.util.NotificationHelper

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        NotificationHelper.createNotificationChannels(this)
        setContent {
            BantAITheme {
                NavGraph()
            }
        }
    }
}
