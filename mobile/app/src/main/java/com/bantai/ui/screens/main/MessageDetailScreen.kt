package com.bantai.ui.screens.main

import android.os.Build
import android.telephony.SmsManager
import android.util.Log
import android.widget.Toast
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.navigation.Screen
import com.bantai.ui.components.AISummaryBottomSheet
import com.bantai.ui.components.SenderAvatar
import com.bantai.ui.components.getRelativeTime
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.White
import com.bantai.viewmodel.MessageDetailViewModel

@Composable
fun MessageDetailScreen(
    sender: String,
    navController: NavController,
    viewModel: MessageDetailViewModel = viewModel(),
) {
    val context = LocalContext.current
    val conversation by viewModel.conversation.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val listState = rememberLazyListState()
    var replyText by remember { mutableStateOf("") }

    LaunchedEffect(sender) {
        viewModel.loadConversation(sender)
    }

    LaunchedEffect(conversation.size) {
        if (conversation.isNotEmpty()) {
            listState.scrollToItem(conversation.size - 1)
        }
    }

    val hasSuspicious = conversation.any { it.classification == "suspicious" }
    val hasUnknown = conversation.any { it.classification == "unknown" }
    var showAISummary by remember { mutableStateOf(false) }

    if (showAISummary) {
        AISummaryBottomSheet(
            isSuspicious = hasSuspicious || hasUnknown,
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
        // Top bar
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
            Column(
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(horizontal = 56.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = sender,
                    color = White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (hasSuspicious) {
                    Text("Suspicious", color = Suspicious, fontSize = 11.sp)
                }
            }
            IconButton(
                onClick = { showAISummary = true },
                modifier = Modifier.align(Alignment.CenterEnd),
            ) {
                Icon(Icons.Default.Psychology, contentDescription = "AI Summary", tint = Indigo)
            }
        }

        HorizontalDivider(color = Surface)

        // Suspicious warning banner
        if (hasSuspicious) {
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
                    "Suspicious messages detected — tap for threat details",
                    color = Suspicious,
                    fontSize = 13.sp,
                    modifier = Modifier.weight(1f),
                )
                Icon(Icons.Default.ChevronRight, contentDescription = null, tint = Suspicious, modifier = Modifier.size(20.dp))
            }
        } else if (hasUnknown) {
            // Unknown sender — likely-suspicious warning with a direct report affordance
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF2A1A00))
                    .clickable { navController.navigate(Screen.TakeAction.route) }
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Icon(Icons.Default.Warning, contentDescription = null, tint = Suspicious, modifier = Modifier.size(20.dp))
                Text(
                    "Suspicious messages detected — tap to report",
                    color = Suspicious,
                    fontSize = 13.sp,
                    modifier = Modifier.weight(1f),
                )
                Icon(Icons.Default.ChevronRight, contentDescription = null, tint = Suspicious, modifier = Modifier.size(20.dp))
            }
        }

        val screenWidth = LocalConfiguration.current.screenWidthDp.dp
        val bubbleMaxWidth = screenWidth * 0.75f

        // Conversation thread
        if (isLoading) {
            Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Indigo, modifier = Modifier.size(32.dp))
            }
        } else if (conversation.isEmpty()) {
            Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text("No messages found", color = TextSecondary, fontSize = 14.sp)
            }
        } else {
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(conversation) { msg ->
                    val isOutgoing = msg.isOutgoing
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = if (isOutgoing) Alignment.End else Alignment.Start,
                    ) {
                        if (!isOutgoing) {
                            Row(
                                verticalAlignment = Alignment.Bottom,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                            ) {
                                SenderAvatar(sender = msg.sender, size = 28.dp)
                                Box(
                                    modifier = Modifier
                                        .widthIn(max = bubbleMaxWidth)
                                        .background(
                                            color = if (msg.classification == "suspicious") Color(0xFF2A1A00) else Surface,
                                            shape = RoundedCornerShape(topStart = 4.dp, topEnd = 16.dp, bottomEnd = 16.dp, bottomStart = 16.dp),
                                        )
                                        .padding(horizontal = 12.dp, vertical = 8.dp),
                                ) {
                                    Column {
                                        Text(msg.body, color = White, fontSize = 14.sp, lineHeight = 20.sp)
                                        Spacer(Modifier.height(2.dp))
                                        Text(
                                            getRelativeTime(msg.timestamp),
                                            color = if (msg.classification == "suspicious") Suspicious.copy(alpha = 0.7f) else TextSecondary,
                                            fontSize = 10.sp,
                                        )
                                    }
                                }
                            }
                        } else {
                            Box(
                                modifier = Modifier
                                    .widthIn(max = bubbleMaxWidth)
                                    .background(
                                        color = Indigo,
                                        shape = RoundedCornerShape(topStart = 16.dp, topEnd = 4.dp, bottomEnd = 16.dp, bottomStart = 16.dp),
                                    )
                                    .padding(horizontal = 12.dp, vertical = 8.dp),
                            ) {
                                Column {
                                    Text(msg.body, color = White, fontSize = 14.sp, lineHeight = 20.sp)
                                    Spacer(Modifier.height(2.dp))
                                    Text(
                                        getRelativeTime(msg.timestamp),
                                        color = White.copy(alpha = 0.6f),
                                        fontSize = 10.sp,
                                        modifier = Modifier.align(Alignment.End),
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // Reply bar
        HorizontalDivider(color = Surface)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .background(Surface, RoundedCornerShape(22.dp))
                    .padding(horizontal = 16.dp, vertical = 10.dp),
            ) {
                BasicTextField(
                    value = replyText,
                    onValueChange = { replyText = it },
                    textStyle = TextStyle(color = White, fontSize = 14.sp),
                    cursorBrush = SolidColor(Indigo),
                    modifier = Modifier.fillMaxWidth(),
                    decorationBox = { inner ->
                        if (replyText.isEmpty()) {
                            Text("Message", color = TextSecondary, fontSize = 14.sp)
                        }
                        inner()
                    },
                )
            }
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .background(if (replyText.isNotEmpty()) Indigo else Surface, CircleShape)
                    .clickable {
                        val body = replyText.trim()
                        if (body.isEmpty()) return@clickable
                        try {
                            @Suppress("DEPRECATION")
                            val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                                context.getSystemService(SmsManager::class.java)
                                    ?: SmsManager.getDefault()
                            } else {
                                SmsManager.getDefault()
                            }
                            val parts = smsManager.divideMessage(body)
                            if (parts.size == 1) {
                                smsManager.sendTextMessage(sender, null, body, null, null)
                            } else {
                                smsManager.sendMultipartTextMessage(sender, null, parts, null, null)
                            }
                            replyText = ""
                            viewModel.loadConversation(sender)
                        } catch (e: Exception) {
                            Log.e("MessageDetailScreen", "Failed to send reply", e)
                            Toast.makeText(context, "Failed to send", Toast.LENGTH_SHORT).show()
                        }
                    },
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowForward,
                    contentDescription = "Send",
                    tint = if (replyText.isNotEmpty()) White else TextSecondary,
                    modifier = Modifier.size(20.dp),
                )
            }
        }
    }
}
