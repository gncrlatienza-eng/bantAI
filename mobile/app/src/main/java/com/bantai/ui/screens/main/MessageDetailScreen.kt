package com.bantai.ui.screens.main

import android.provider.Telephony
import android.util.Log
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
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
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.data.SmsRepository
import com.bantai.data.local.UserPreferences
import com.bantai.data.model.SendStatus
import com.bantai.data.model.SmsMessage
import com.bantai.data.remote.SummarizeApi
import com.bantai.navigation.Screen
import com.bantai.ui.components.AISummaryBottomSheet
import com.bantai.ui.components.SenderAvatar
import com.bantai.ui.components.getRelativeTime
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.IosBlue
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White
import com.bantai.util.NotificationHelper
import com.bantai.util.SmsSender
import com.bantai.viewmodel.MessageDetailViewModel
import kotlinx.coroutines.flow.first

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun MessageDetailScreen(
    sender: String,
    navController: NavController,
    viewModel: MessageDetailViewModel = viewModel(),
) {
    val context = LocalContext.current
    val conversation by viewModel.conversation.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val selectionMode by viewModel.selectionMode.collectAsState()
    val selectedIds by viewModel.selectedIds.collectAsState()
    val draftBody by viewModel.draftBody.collectAsState()
    val listState = rememberLazyListState()
    val focusManager = LocalFocusManager.current
    val keyboardController = LocalSoftwareKeyboardController.current
    var replyText by remember { mutableStateOf("") }
    var replyPrefilled by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }

    BackHandler(enabled = selectionMode) { viewModel.exitSelectionMode() }

    LaunchedEffect(sender) {
        viewModel.loadConversation(sender)
        viewModel.markAsRead(sender)
    }

    // Resume any unsent reply left from a previous visit, once — after that, typing
    // (or a later unrelated draft update) shouldn't clobber what's in the box.
    LaunchedEffect(draftBody) {
        if (!replyPrefilled && draftBody.isNotEmpty()) {
            replyText = draftBody
            replyPrefilled = true
        }
    }

    // Leaving this screen preserves whatever is currently in the reply box as a
    // draft. Safe to call unconditionally, including right after a send: replyText
    // is cleared to "" on success, and DraftsStore treats a blank body as "clear
    // the draft" rather than storing an empty one.
    DisposableEffect(sender) {
        onDispose {
            viewModel.saveDraft(replyText)
        }
    }

    LaunchedEffect(conversation.size) {
        if (conversation.isNotEmpty()) {
            listState.scrollToItem(conversation.size - 1)
        }
    }

    fun retryFailedMessage(msg: SmsMessage) {
        try {
            val repo = SmsRepository(context)
            repo.updateMessageType(msg.id, Telephony.Sms.MESSAGE_TYPE_OUTBOX)
            viewModel.loadConversation(sender)
            SmsSender.send(context, sender, msg.body) { success, error ->
                repo.updateMessageType(msg.id, if (success) Telephony.Sms.MESSAGE_TYPE_SENT else Telephony.Sms.MESSAGE_TYPE_FAILED)
                if (!success) {
                    Toast.makeText(context, error ?: "Failed to send", Toast.LENGTH_LONG).show()
                    NotificationHelper.sendFailedMessageNotification(context, sender, msg.body, NotificationHelper.notifIdFor(sender))
                }
            }
        } catch (e: Exception) {
            Log.e("MessageDetailScreen", "Failed to retry message ${msg.id}", e)
            Toast.makeText(context, "Failed to send message", Toast.LENGTH_SHORT).show()
        }
    }

    val hasSuspicious = conversation.any { it.classification == "suspicious" }
    val hasUnknown = conversation.any { it.classification == "unknown" }
    var showAISummary by remember { mutableStateOf(false) }
    var summaryText by remember { mutableStateOf<String?>(null) }
    var isSummaryLoading by remember { mutableStateOf(false) }

    // Reset whenever the thread changes so a stale summary from a previous
    // conversation can never be shown against this one.
    LaunchedEffect(sender) {
        summaryText = null
    }

    // Fetched lazily on first open, once per thread — not on every recomposition.
    LaunchedEffect(showAISummary, conversation) {
        if (showAISummary && summaryText == null && !isSummaryLoading && conversation.isNotEmpty()) {
            isSummaryLoading = true
            val token = UserPreferences(context).userData.first().authToken
            if (token.isNotEmpty()) {
                SummarizeApi
                    .summarize(token, conversation.map { it.body })
                    .onSuccess { summaryText = it.summary }
            }
            isSummaryLoading = false
        }
    }

    if (showAISummary) {
        AISummaryBottomSheet(
            isSuspicious = hasSuspicious || hasUnknown,
            summary = summaryText,
            isLoadingSummary = isSummaryLoading,
            onDismiss = { showAISummary = false },
            onViewFullAnalysis = {
                showAISummary = false
                navController.navigate(Screen.ThreatAnalysis.createRoute())
            },
        )
    }

    if (showDeleteConfirm) {
        val count = selectedIds.size
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            containerColor = SurfaceElevated,
            title = { Text("Delete $count message${if (count == 1) "" else "s"}?", color = White) },
            text = { Text("They'll move to Recently Deleted.", color = TextSecondary) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deleteSelected()
                    showDeleteConfirm = false
                }) { Text("Delete", color = Danger) }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) { Text("Cancel", color = TextSecondary) }
            },
        )
    }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black)
                .imePadding(),
    ) {
        // Top bar
        if (selectionMode) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(horizontal = 12.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = { viewModel.exitSelectionMode() }) {
                    Icon(Icons.Filled.Close, contentDescription = "Cancel", tint = White)
                }
                Text(
                    if (selectedIds.isEmpty()) "Select messages" else "${selectedIds.size} selected",
                    color = White,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 17.sp,
                    modifier = Modifier.weight(1f).padding(start = 4.dp),
                )
                TextButton(onClick = { viewModel.selectAll() }) {
                    Text("Select All", color = IosBlue, fontSize = 14.sp)
                }
                IconButton(onClick = { showDeleteConfirm = true }, enabled = selectedIds.isNotEmpty()) {
                    Icon(
                        Icons.Filled.Delete,
                        contentDescription = "Delete",
                        tint = if (selectedIds.isNotEmpty()) Danger else TextTertiary,
                    )
                }
            }
        } else {
            Box(
                modifier =
                    Modifier
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
                    modifier =
                        Modifier
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
        }

        HorizontalDivider(color = Surface)

        // Suspicious warning banner
        if (hasSuspicious) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF2A1A00))
                        .clickable { navController.navigate(Screen.ThreatAnalysis.createRoute()) }
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
                modifier =
                    Modifier
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
        } else if (errorMessage != null) {
            Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text(errorMessage ?: "Couldn't load this conversation", color = Danger, fontSize = 14.sp)
            }
        } else if (conversation.isEmpty()) {
            Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text("No messages found", color = TextSecondary, fontSize = 14.sp)
            }
        } else {
            LazyColumn(
                state = listState,
                modifier =
                    Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        // Tapping the thread background (not a message row, not the reply
                        // field — those are separate elements with their own tap handling)
                        // dismisses the keyboard, same as any normal messaging app.
                        .pointerInput(Unit) {
                            detectTapGestures(onPress = {
                                focusManager.clearFocus()
                                keyboardController?.hide()
                            })
                        },
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(conversation) { msg ->
                    val isOutgoing = msg.isOutgoing
                    val isSelected = msg.id in selectedIds
                    Column(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .combinedClickable(
                                    onClick = { if (selectionMode) viewModel.toggleSelected(msg.id) },
                                    onLongClick = { if (!selectionMode) viewModel.enterSelectionMode(msg.id) },
                                ),
                        horizontalAlignment = if (isOutgoing) Alignment.End else Alignment.Start,
                    ) {
                        Row(
                            verticalAlignment = Alignment.Bottom,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            if (selectionMode) {
                                Icon(
                                    imageVector = if (isSelected) Icons.Filled.CheckCircle else Icons.Outlined.Circle,
                                    contentDescription = if (isSelected) "Selected" else "Not selected",
                                    tint = if (isSelected) Indigo else TextTertiary,
                                    modifier = Modifier.size(20.dp),
                                )
                            }
                            if (!isOutgoing) {
                                SenderAvatar(sender = msg.sender, size = 28.dp)
                                Box(
                                    modifier =
                                        Modifier
                                            .widthIn(max = bubbleMaxWidth)
                                            .background(
                                                color = if (msg.classification == "suspicious") Color(0xFF2A1A00) else Surface,
                                                shape =
                                                    RoundedCornerShape(
                                                        topStart = 4.dp,
                                                        topEnd = 16.dp,
                                                        bottomEnd = 16.dp,
                                                        bottomStart = 16.dp,
                                                    ),
                                            ).padding(horizontal = 12.dp, vertical = 8.dp),
                                ) {
                                    Column {
                                        Text(msg.body, color = White, fontSize = 14.sp, lineHeight = 20.sp)
                                        Spacer(Modifier.height(2.dp))
                                        Text(
                                            getRelativeTime(msg.timestamp),
                                            color =
                                                if (msg.classification ==
                                                    "suspicious"
                                                ) {
                                                    Suspicious.copy(alpha = 0.7f)
                                                } else {
                                                    TextSecondary
                                                },
                                            fontSize = 10.sp,
                                        )
                                    }
                                }
                            } else {
                                Box(
                                    modifier =
                                        Modifier
                                            .widthIn(max = bubbleMaxWidth)
                                            .background(
                                                color = if (msg.sendStatus == SendStatus.FAILED) Indigo.copy(alpha = 0.5f) else Indigo,
                                                shape =
                                                    RoundedCornerShape(
                                                        topStart = 16.dp,
                                                        topEnd = 4.dp,
                                                        bottomEnd = 16.dp,
                                                        bottomStart = 16.dp,
                                                    ),
                                            ).padding(horizontal = 12.dp, vertical = 8.dp),
                                ) {
                                    Column {
                                        Text(msg.body, color = White, fontSize = 14.sp, lineHeight = 20.sp)
                                        Spacer(Modifier.height(2.dp))
                                        Text(
                                            if (msg.sendStatus == SendStatus.SENDING) "Sending…" else getRelativeTime(msg.timestamp),
                                            color = White.copy(alpha = 0.6f),
                                            fontSize = 10.sp,
                                            modifier = Modifier.align(Alignment.End),
                                        )
                                    }
                                }
                            }
                        }
                        if (isOutgoing && msg.sendStatus == SendStatus.FAILED) {
                            Row(
                                modifier =
                                    Modifier
                                        .padding(top = 2.dp)
                                        .clickable { retryFailedMessage(msg) },
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                            ) {
                                Icon(Icons.Default.Warning, contentDescription = null, tint = Danger, modifier = Modifier.size(12.dp))
                                Text("Not delivered · Tap to retry", color = Danger, fontSize = 11.sp)
                            }
                        }
                    }
                }
            }
        }

        // Reply bar
        HorizontalDivider(color = Surface)
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(
                modifier =
                    Modifier
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
                modifier =
                    Modifier
                        .size(44.dp)
                        .background(if (replyText.isNotEmpty()) Indigo else Surface, CircleShape)
                        .clickable {
                            val body = replyText.trim()
                            if (body.isEmpty()) return@clickable
                            try {
                                // Record as Outbox and clear the box immediately — the new
                                // bubble shows a "Sending…" state right away instead of
                                // waiting on the network round trip for anything to appear.
                                val repo = SmsRepository(context)
                                val outboxId = repo.insertOutgoingMessage(sender, body)
                                viewModel.clearDraft()
                                replyText = ""
                                viewModel.loadConversation(sender)
                                SmsSender.send(context, sender, body) { success, error ->
                                    if (outboxId != null) {
                                        repo.updateMessageType(
                                            outboxId,
                                            if (success) Telephony.Sms.MESSAGE_TYPE_SENT else Telephony.Sms.MESSAGE_TYPE_FAILED,
                                        )
                                    }
                                    if (!success) {
                                        Toast.makeText(context, error ?: "Failed to send", Toast.LENGTH_LONG).show()
                                        NotificationHelper.sendFailedMessageNotification(
                                            context,
                                            sender,
                                            body,
                                            NotificationHelper.notifIdFor(sender),
                                        )
                                    }
                                }
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
