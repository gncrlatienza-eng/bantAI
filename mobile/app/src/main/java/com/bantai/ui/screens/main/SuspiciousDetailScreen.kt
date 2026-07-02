package com.bantai.ui.screens.main

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.bantai.ui.components.AISummaryBottomSheet
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.navigation.Screen
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.White

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SuspiciousDetailScreen(sender: String, navController: NavController) {
    var showAISummary by remember { mutableStateOf(false) }

    if (showAISummary) {
        AISummaryBottomSheet(
            onDismiss = { showAISummary = false },
            onViewFullAnalysis = {
                showAISummary = false
                navController.navigate(Screen.ThreatAnalysis.route)
            },
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Black),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 4.dp, vertical = 4.dp),
        ) {
            IconButton(
                onClick = { navController.popBackStack() },
                modifier = Modifier.align(Alignment.CenterStart),
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = White)
            }
            Text(
                sender,
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp,
                modifier = Modifier.align(Alignment.Center),
            )
            IconButton(
                onClick = { showAISummary = true },
                modifier = Modifier.align(Alignment.CenterEnd),
            ) {
                Icon(Icons.Default.Psychology, contentDescription = "AI Analysis", tint = Indigo)
            }
        }

        Box(
            modifier = Modifier
                .padding(horizontal = 20.dp, vertical = 4.dp)
                .background(Suspicious.copy(alpha = 0.2f), RoundedCornerShape(100.dp))
                .padding(horizontal = 10.dp, vertical = 4.dp),
        ) {
            Text("Suspicious", color = Suspicious, fontSize = 12.sp, fontWeight = FontWeight.Medium)
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF2A1A00))
                .clickable { navController.navigate(Screen.ThreatAnalysis.route) }
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Icon(Icons.Default.Warning, contentDescription = null, tint = Suspicious, modifier = Modifier.size(20.dp))
            Text(
                "Suspicious — Tap for threat details and actions",
                color = Suspicious,
                fontSize = 13.sp,
                modifier = Modifier.weight(1f),
            )
            Icon(Icons.Default.ChevronRight, contentDescription = null, tint = Suspicious, modifier = Modifier.size(20.dp))
        }

        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .background(Black),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item { DateSeparator("May 7") }
            item {
                ChatBubble(
                    text = "Your BDO account statement for April is now available. Log in to view it.",
                    time = "8:00 AM",
                )
            }
            item { DateSeparator("Today") }
            item {
                ChatBubble(
                    text = "Thank you for banking with BDO. Your balance inquiry was successful.",
                    time = "8:30 AM",
                )
            }
            item { FlaggedChatBubble(navController = navController) }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(44.dp)
                    .background(Surface, RoundedCornerShape(22.dp))
                    .padding(horizontal = 16.dp),
                contentAlignment = Alignment.CenterStart,
            ) {
                Text("Message", color = TextSecondary, fontSize = 14.sp)
            }
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .background(Surface, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = "Send", tint = TextSecondary, modifier = Modifier.size(20.dp))
            }
        }
    }
}

@Composable
private fun DateSeparator(text: String) {
    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Text(text, color = TextSecondary, fontSize = 12.sp)
    }
}

@Composable
private fun ChatBubble(text: String, time: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth(0.85f)
            .background(
                Surface,
                RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomEnd = 16.dp, bottomStart = 4.dp),
            )
            .padding(12.dp),
    ) {
        Text(text, color = White, fontSize = 14.sp)
        Spacer(Modifier.height(4.dp))
        Text(time, color = TextSecondary, fontSize = 11.sp, modifier = Modifier.align(Alignment.End))
    }
}

@Composable
private fun FlaggedChatBubble(navController: NavController) {
    Column(
        modifier = Modifier
            .fillMaxWidth(0.85f)
            .background(
                Surface,
                RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomEnd = 16.dp, bottomStart = 4.dp),
            )
            .padding(12.dp),
    ) {
        Text(
            buildAnnotatedString {
                withStyle(SpanStyle(color = White)) {
                    append("You have a pending transaction of ₱12,500. Tap to confirm here: ")
                }
                withStyle(SpanStyle(color = Danger, textDecoration = TextDecoration.LineThrough)) {
                    append("bdo-secure-ph.net/transactions/confirm")
                }
            },
            fontSize = 14.sp,
        )
        Spacer(Modifier.height(8.dp))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF2A0000), RoundedCornerShape(8.dp))
                .clickable { navController.navigate(Screen.UnsafeLink.route) }
                .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Icon(Icons.Default.Shield, contentDescription = null, tint = Danger, modifier = Modifier.size(16.dp))
            Text("Flagged link — tap to see details", color = Danger, fontSize = 12.sp)
        }
        Spacer(Modifier.height(4.dp))
        Text("8:42 AM", color = TextSecondary, fontSize = 11.sp, modifier = Modifier.align(Alignment.End))
    }
}
