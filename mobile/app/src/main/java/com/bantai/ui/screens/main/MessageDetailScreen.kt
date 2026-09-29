package com.bantai.ui.screens.main

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
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Block
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.MoreHoriz
import androidx.compose.material.icons.outlined.ReportGmailerrorred
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
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
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.data.OutgoingSms
import com.bantai.data.local.BackendMessageIdStore
import com.bantai.data.local.UserPreferences
import com.bantai.data.model.ConversationView
import com.bantai.data.model.SendStatus
import com.bantai.data.model.SmsMessage
import com.bantai.data.model.describeThread
import com.bantai.data.model.summarizeThread
import com.bantai.data.remote.VerificationApi
import com.bantai.navigation.Screen
import com.bantai.ui.components.AISummaryBottomSheet
import com.bantai.ui.components.ChatThreadSkeleton
import com.bantai.ui.components.SenderAvatar
import com.bantai.ui.components.getRelativeTime
import com.bantai.ui.components.rememberSmsSendPermission
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.IosBlue
import com.bantai.ui.theme.OnAccent
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White
import com.bantai.util.SenderReplyKind
import com.bantai.util.SmsLinkSafety
import com.bantai.util.SmsRiskSignals
import com.bantai.util.TrustedSenders
import com.bantai.util.isValidSmsRecipient
import com.bantai.util.replyKindFor
import com.bantai.util.serviceCodeLabel
import com.bantai.viewmodel.MessageDetailViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext

// Caps the AI Summary's TF-IDF scoring pass to the most recent incoming
// messages in a very long-running thread, rather than the whole history.
private const val MAX_AI_SUMMARY_SOURCE_MESSAGES = 50

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun MessageDetailScreen(
    sender: String,
    navController: NavController,
    viewModel: MessageDetailViewModel = viewModel(),
    initialView: ConversationView = ConversationView.ALL,
) {
    val context = LocalContext.current
    val fullConversation by viewModel.conversation.collectAsState()
    // Opened from a chip, only that chip's slice of the sender is shown (and
    // drives the banner and summary), so GLOBE's OTPs and its promos don't mix.
    // Opened from a tab, a thread shows only that tab's messages: a sender that
    // mixes OTPs and promos appears in both Messages and Spam, each with its
    // own slice. (There used to be a "show only / show all" toggle here.)
    val conversation = remember(fullConversation, initialView) { fullConversation.filter { initialView.includes(it) } }
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
    var senderVerification by remember(sender) { mutableStateOf<VerificationApi.SenderVerification?>(null) }
    // The backend messageId for this thread's most recently flagged message --
    // TakeAction's Report needs this backend UUID, which the SMS provider row
    // itself has no column for (see BackendMessageIdStore). Previously the
    // banners below navigated to TakeAction with no messageId at all, which
    // silently disabled Report for every in-thread entry point.
    var flaggedMessageId by remember(sender) { mutableStateOf("") }

    BackHandler(enabled = selectionMode) { viewModel.exitSelectionMode() }

    LaunchedEffect(sender) {
        viewModel.loadConversation(sender)
        viewModel.markAsRead(sender)
        val token = UserPreferences(context).userData.first().authToken
        if (token.isNotEmpty()) {
            senderVerification = VerificationApi.verifySender(token, sender).getOrNull()
        }
    }

    LaunchedEffect(conversation) {
        val flagged = conversation.lastOrNull { it.classification == "blocked" || it.classification == "unknown" }
        flaggedMessageId =
            if (flagged != null) {
                withContext(Dispatchers.IO) { BackendMessageIdStore(context).get(flagged.id) }.orEmpty()
            } else {
                ""
            }
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

    val withSmsPermission = rememberSmsSendPermission()

    fun retryFailedMessage(msg: SmsMessage) {
        withSmsPermission { OutgoingSms.retry(context, msg) }
    }

    // Telcos, banks, e-wallets, Google and other big apps (built-in list), or an
    // organisation the backend registry verified. Their threads show no warnings
    // and no report/block -- only the AI summary. See TrustedSenders.
    val isTrusted = TrustedSenders.isTrusted(sender, senderVerification?.familiarity)
    val hasSuspicious = !isTrusted && conversation.any { it.classification == "blocked" }
    val hasUnknown = !isTrusted && conversation.any { it.classification == "unknown" }
    // The one exception for a trusted name: content that gives a spoof away
    // (a bank sending a link, anyone asking for an OTP). Names are fakeable,
    // e.g. by SMS blasters, so this gets a warning with Report -- never Block,
    // which would also cut off the real sender. See SmsRiskSignals.spoofWarning.
    val spoofWarning =
        remember(conversation, isTrusted) {
            if (!isTrusted) {
                null
            } else {
                conversation
                    .asReversed()
                    .firstNotNullOfOrNull { msg ->
                        if (msg.isOutgoing) null else SmsRiskSignals.spoofWarning(sender, msg.body)
                    }
            }
        }

    // Report works for any message, whatever its verdict: TakeAction resolves (or
    // registers) the backend id from the device row, and hides the option that
    // would repeat the current label. Defaults to the flagged message, else the
    // newest incoming message in the slice being shown.
    fun openReport(
        target: SmsMessage? = null,
        action: String = "",
        canBlock: Boolean = true,
    ) {
        val message =
            target
                ?: conversation.lastOrNull { it.classification == "blocked" || it.classification == "unknown" }
                ?: conversation.lastOrNull { !it.isOutgoing }
        val currentLabel =
            when (message?.classification) {
                "safe", "unverified" -> "Ham"
                "spam" -> "Spam"
                "blocked" -> "Scam"
                else -> ""
            }
        val knownBackendId = if (target == null) flaggedMessageId else ""
        navController.navigate(
            Screen.TakeAction.createRoute(
                messageId = knownBackendId,
                sender = sender,
                localId = message?.id?.takeIf { it > 0 },
                currentLabel = currentLabel,
                action = action,
                canBlock = canBlock,
            ),
        )
    }
    var showAISummary by remember { mutableStateOf(false) }
    var summaryText by remember { mutableStateOf<String?>(null) }
    var summaryLoading by remember { mutableStateOf(false) }
    var summarySourceCount by remember { mutableStateOf(0) }
    var summaryTopic by remember { mutableStateOf<String?>(null) }

    // Reset whenever the thread or its visible slice changes so a stale summary
    // can never be shown against different messages.
    LaunchedEffect(sender, initialView) {
        summaryText = null
        summarySourceCount = 0
        summaryTopic = null
    }

    // Computed on-device (TF-IDF extractive, data/model/SmsConversations.kt) --
    // the backend's POST /ai/summarize is disabled (410 Gone) in privacy-first
    // mode, there is no remote summarizer to call here. Only incoming messages
    // go in; the most recent ones, capped, so a very long thread doesn't stall
    // this on the scoring pass.
    LaunchedEffect(showAISummary, sender, initialView) {
        if (showAISummary && summaryText == null) {
            summaryLoading = true
            val incoming = conversation.filter { !it.isOutgoing }.takeLast(MAX_AI_SUMMARY_SOURCE_MESSAGES)
            // The summary quotes message sentences, so it hides links under the
            // same rule as the bubbles: only an all-safe thread keeps them.
            val keepLinks = incoming.all { SmsLinkSafety.visibleBody(it.body, it.classification, sender) == it.body }
            val (result, topic) =
                withContext(Dispatchers.Default) {
                    val summary = summarizeThread(incoming)
                    val about = describeThread(incoming, sender)
                    if (keepLinks) {
                        summary to about
                    } else {
                        summary?.let(SmsLinkSafety::hideLinks) to about?.let(SmsLinkSafety::hideLinks)
                    }
                }
            summaryTopic = topic
            if (result != null) {
                summaryText = result
                // Only set on a real summary -- the sheet uses this to show a
                // "Summary of N messages" caption, which shouldn't appear next
                // to the "not enough content" fallback below.
                summarySourceCount = incoming.size
            } else {
                summaryText = if (topic != null) "" else "Not enough content to summarize this conversation."
            }
            summaryLoading = false
        }
    }

    if (showAISummary) {
        AISummaryBottomSheet(
            isSuspicious = hasSuspicious || hasUnknown,
            isTrusted = isTrusted,
            summary = summaryText,
            sourceMessageCount = summarySourceCount.takeIf { it > 0 },
            isLoadingSummary = summaryLoading,
            topic = summaryTopic,
            onDismiss = { showAISummary = false },
            onViewFullAnalysis = {
                showAISummary = false
                // Same reasoning as the in-thread warning banners below: Take
                // Action is the only screen with a working Report/Block entry
                // point, ThreatAnalysisScreen's action button is permanently
                // disabled.
                openReport()
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
                    fontSize = TextSize.Headline,
                    modifier = Modifier.weight(1f).padding(start = 4.dp),
                )
                TextButton(onClick = { viewModel.selectAll(conversation.map { it.id }) }) {
                    Text("Select All", color = IosBlue, fontSize = TextSize.Subhead)
                }
                val reportTarget = conversation.singleOrNull { it.id in selectedIds }?.takeIf { !it.isOutgoing }
                if (!isTrusted) {
                    IconButton(
                        onClick = {
                            viewModel.exitSelectionMode()
                            openReport(reportTarget, action = "report")
                        },
                        enabled = reportTarget != null && selectedIds.size == 1,
                    ) {
                        Icon(
                            Icons.Outlined.ReportGmailerrorred,
                            contentDescription = "Report message",
                            tint = if (reportTarget != null && selectedIds.size == 1) White else TextTertiary,
                        )
                    }
                }
                IconButton(onClick = { showDeleteConfirm = true }, enabled = selectedIds.isNotEmpty()) {
                    Icon(
                        Icons.Outlined.Delete,
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
                            .padding(horizontal = 100.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = sender,
                        color = White,
                        fontWeight = FontWeight.Bold,
                        fontSize = TextSize.Body,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (hasSuspicious) {
                        Text("Suspicious", color = Suspicious, fontSize = TextSize.Caption2)
                    } else if (isTrusted && senderVerification?.familiarity != "verified_organization") {
                        Text("Trusted sender", color = IosBlue, fontSize = TextSize.Caption2)
                    } else if (senderVerification?.risk == "confirmed_fraud") {
                        Text("Confirmed fraud", color = Suspicious, fontSize = TextSize.Caption2)
                    } else if (senderVerification?.familiarity == "verified_organization") {
                        Text(
                            "Verified organization${senderVerification?.organizationName?.let { " • $it" } ?: ""}",
                            color = IosBlue,
                            fontSize = TextSize.Caption2,
                        )
                    } else if (senderVerification?.familiarity == "known_contact") {
                        Text("Known contact", color = IosBlue, fontSize = TextSize.Caption2)
                    }
                }
                Row(modifier = Modifier.align(Alignment.CenterEnd)) {
                    IconButton(onClick = { showAISummary = true }) {
                        Icon(Icons.Outlined.AutoAwesome, contentDescription = "AI Summary", tint = Indigo)
                    }
                    if (!isTrusted) {
                        ThreadMenu(
                            enabled = conversation.any { !it.isOutgoing },
                            onReport = { openReport(action = "report") },
                            onBlock = { openReport(action = "block") },
                        )
                    }
                }
            }
        }

        HorizontalDivider(color = Surface)

        // Suspicious warning -- goes straight to Take Action (Report/Block)
        // rather than the disabled-action ThreatAnalysisScreen; see
        // flaggedMessageId's comment above for why this needs its own lookup.
        // Never shown for a trusted sender (hasSuspicious/hasUnknown are false).
        if (hasSuspicious || hasUnknown) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                        .background(Suspicious.copy(alpha = 0.12f), RoundedCornerShape(12.dp))
                        .clickable { openReport() }
                        .padding(horizontal = 14.dp, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Icon(
                    Icons.Outlined.WarningAmber,
                    contentDescription = null,
                    tint = Suspicious,
                    modifier = Modifier.size(18.dp),
                )
                Text(
                    if (hasSuspicious) "This conversation looks like a scam" else "Some messages here look suspicious",
                    color = White,
                    fontSize = TextSize.Footnote,
                    modifier = Modifier.weight(1f),
                )
                Text("Review", color = Suspicious, fontSize = TextSize.Footnote, fontWeight = FontWeight.SemiBold)
            }
        } else if (spoofWarning != null) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                        .background(Suspicious.copy(alpha = 0.12f), RoundedCornerShape(12.dp))
                        .clickable { openReport(action = "report", canBlock = false) }
                        .padding(horizontal = 14.dp, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Icon(
                    Icons.Outlined.WarningAmber,
                    contentDescription = null,
                    tint = Suspicious,
                    modifier = Modifier.size(18.dp),
                )
                Text(spoofWarning, color = White, fontSize = TextSize.Footnote, modifier = Modifier.weight(1f))
                Text("Report", color = Suspicious, fontSize = TextSize.Footnote, fontWeight = FontWeight.SemiBold)
            }
        }

        val screenWidth = LocalConfiguration.current.screenWidthDp.dp
        val bubbleMaxWidth = screenWidth * 0.75f

        // Conversation thread
        if (isLoading) {
            ChatThreadSkeleton(modifier = Modifier.weight(1f).fillMaxWidth())
        } else if (errorMessage != null) {
            Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text(errorMessage ?: "Couldn't load this conversation", color = Danger, fontSize = TextSize.Subhead)
            }
        } else if (conversation.isEmpty()) {
            Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text("No messages found", color = TextSecondary, fontSize = TextSize.Subhead)
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
                                                color =
                                                    if (msg.classification == "blocked" && !isTrusted) {
                                                        Suspicious.copy(alpha = 0.15f)
                                                    } else {
                                                        Surface
                                                    },
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
                                        Text(
                                            SmsLinkSafety.visibleBody(msg.body, msg.classification, msg.sender),
                                            color = White,
                                            fontSize = TextSize.Subhead,
                                            lineHeight = 20.sp,
                                        )
                                        Spacer(Modifier.height(2.dp))
                                        Text(
                                            getRelativeTime(msg.timestamp),
                                            color =
                                                if (msg.classification == "blocked" && !isTrusted) {
                                                    Suspicious.copy(alpha = 0.7f)
                                                } else {
                                                    TextSecondary
                                                },
                                            fontSize = TextSize.Caption2,
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
                                        Text(
                                            msg.body,
                                            color = OnAccent,
                                            fontSize = TextSize.Subhead,
                                            lineHeight = 20.sp,
                                        )
                                        Spacer(Modifier.height(2.dp))
                                        Text(
                                            if (msg.sendStatus == SendStatus.SENDING) "Sending…" else getRelativeTime(msg.timestamp),
                                            color = OnAccent.copy(alpha = 0.7f),
                                            fontSize = TextSize.Caption2,
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
                                Text("Not delivered · Tap to retry", color = Danger, fontSize = TextSize.Caption2)
                            }
                        }
                    }
                }
            }
        }

        // Reply bar -- an alphanumeric sender ID (e.g. "GCash", "PLDTHome") has no
        // SMS return path at all, so replying would always fail after SmsSender's
        // 20s timeout with no way to succeed; show a disabled notice instead.
        // Service short codes (8080, 3733) do take replies, with a load caution.
        if (isValidSmsRecipient(sender)) {
            if (replyKindFor(sender) == SenderReplyKind.SERVICE_CODE) {
                val purpose = serviceCodeLabel(sender)?.let { "$sender · $it. " } ?: "$sender is a service number. "
                Text(
                    purpose + "Sending a keyword here can register a promo and deduct load.",
                    color = TextSecondary,
                    fontSize = TextSize.Caption2,
                    lineHeight = 15.sp,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
                )
            }
            ReplyBar(
                sender = sender,
                replyText = replyText,
                onReplyTextChange = { replyText = it },
                viewModel = viewModel,
            )
        } else {
            UnreachableSenderNotice(sender)
        }
    }
}

// Report and Block live behind one "..." menu, iOS-style, rather than a
// colored flag in the title bar.
@Composable
private fun ThreadMenu(
    enabled: Boolean,
    onReport: () -> Unit,
    onBlock: () -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        IconButton(onClick = { expanded = true }, enabled = enabled) {
            Icon(
                Icons.Outlined.MoreHoriz,
                contentDescription = "More",
                tint = if (enabled) White else TextTertiary,
            )
        }
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            containerColor = SurfaceElevated,
            shape = RoundedCornerShape(14.dp),
        ) {
            DropdownMenuItem(
                text = { Text("Report message", color = White, fontSize = TextSize.Body) },
                trailingIcon = {
                    Icon(
                        Icons.Outlined.ReportGmailerrorred,
                        contentDescription = null,
                        tint = White,
                        modifier = Modifier.size(20.dp),
                    )
                },
                onClick = {
                    expanded = false
                    onReport()
                },
            )
            HorizontalDivider(color = Hairline, thickness = 0.5.dp)
            DropdownMenuItem(
                text = { Text("Block sender", color = Danger, fontSize = TextSize.Body) },
                trailingIcon = {
                    Icon(
                        Icons.Outlined.Block,
                        contentDescription = null,
                        tint = Danger,
                        modifier = Modifier.size(20.dp),
                    )
                },
                onClick = {
                    expanded = false
                    onBlock()
                },
            )
        }
    }
}

@Composable
private fun ReplyBar(
    sender: String,
    replyText: String,
    onReplyTextChange: (String) -> Unit,
    viewModel: MessageDetailViewModel,
) {
    val context = LocalContext.current
    val withSmsPermission = rememberSmsSendPermission()
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
                onValueChange = onReplyTextChange,
                textStyle = TextStyle(color = White, fontSize = TextSize.Subhead),
                cursorBrush = SolidColor(Indigo),
                modifier = Modifier.fillMaxWidth(),
                decorationBox = { inner ->
                    if (replyText.isEmpty()) {
                        Text("Message", color = TextSecondary, fontSize = TextSize.Subhead)
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
                        // The bubble shows "Sending…" at once and settles to sent or
                        // "Not delivered · Tap to retry" -- see OutgoingSms.
                        withSmsPermission {
                            OutgoingSms.send(context, sender, body)
                            viewModel.clearDraft()
                            onReplyTextChange("")
                        }
                    },
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Filled.ArrowUpward,
                contentDescription = "Send",
                tint = if (replyText.isNotEmpty()) OnAccent else TextSecondary,
                modifier = Modifier.size(20.dp),
            )
        }
    }
}

@Composable
private fun UnreachableSenderNotice(sender: String) {
    HorizontalDivider(color = Surface)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 16.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.Center,
    ) {
        Text(
            "Can't reply to $sender — this sender doesn't accept text replies.",
            color = TextSecondary,
            fontSize = TextSize.Caption,
            textAlign = TextAlign.Center,
        )
    }
}
