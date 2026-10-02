package com.bantai.ui.screens.main

import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Restore
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Inbox
import androidx.compose.material.icons.outlined.ReportGmailerrorred
import androidx.compose.material3.AlertDialog
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
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.data.OutgoingSms
import com.bantai.data.model.Classification
import com.bantai.data.model.ConversationView
import com.bantai.data.model.MmsDownloadState
import com.bantai.data.model.SmsMessage
import com.bantai.data.model.describeThread
import com.bantai.data.model.isGroupKey
import com.bantai.data.model.normalizeSenderKey
import com.bantai.data.model.summarizeThread
import com.bantai.navigation.Screen
import com.bantai.ui.components.AISummaryBottomSheet
import com.bantai.ui.components.ChatThreadSkeleton
import com.bantai.ui.components.StateMessage
import com.bantai.ui.components.rememberSmsSendPermission
import com.bantai.ui.screens.main.thread.DayDivider
import com.bantai.ui.screens.main.thread.DeletedActionsBar
import com.bantai.ui.screens.main.thread.FocusedMessage
import com.bantai.ui.screens.main.thread.FocusedMessageOverlay
import com.bantai.ui.screens.main.thread.MessageBubble
import com.bantai.ui.screens.main.thread.MessageRow
import com.bantai.ui.screens.main.thread.ReplyBar
import com.bantai.ui.screens.main.thread.ThreadMenu
import com.bantai.ui.screens.main.thread.ThreadWarningBanner
import com.bantai.ui.screens.main.thread.UnreachableSenderNotice
import com.bantai.ui.screens.main.thread.messageActions
import com.bantai.ui.screens.main.thread.shareableText
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.IosBlue
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.SuspiciousText
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White
import com.bantai.util.ActiveConversation
import com.bantai.util.MessageTime
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

// Scrolls past the top of the last message to the end of the list. Scrolling
// to the item alone lined up its *top*: a tall last message (a photo) left its
// bottom -- and its "Not delivered · Tap to retry" line -- below the reply bar.
// The list clamps the offset at its end.
private const val SCROLL_TO_END_PX = 100_000

@OptIn(ExperimentalFoundationApi::class)
@Composable
@Suppress("LongMethod", "CyclomaticComplexMethod") // the whole thread screen; splitting it is a separate refactor
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
    // Opened from Recently Deleted: only this sender's deleted messages, with
    // Recover / Delete instead of a reply bar.
    val deletedView = initialView == ConversationView.DELETED
    var permanentDeleteIds by remember { mutableStateOf<Set<Long>?>(null) }
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
    // The message whose long-press menu is open, and the one the reply bar is replying to.
    var focused by remember { mutableStateOf<FocusedMessage?>(null) }
    val haptics = LocalHapticFeedback.current
    var replyingTo by remember(sender) { mutableStateOf<SmsMessage?>(null) }
    val replyQuotes by viewModel.replyQuotes.collectAsState()
    val clipboard = LocalClipboardManager.current
    val senderVerification by viewModel.senderVerification.collectAsState()
    val flaggedMessageId by viewModel.flaggedMessageId.collectAsState()
    val contactName by viewModel.contactName.collectAsState()
    val memberNames by viewModel.memberNames.collectAsState()
    val isGroup = isGroupKey(sender)
    // Only the newest sent message says "Delivered", like iMessage.
    val lastOutgoingId = conversation.lastOrNull { it.isOutgoing }?.id

    BackHandler(enabled = selectionMode) { viewModel.exitSelectionMode() }

    LaunchedEffect(sender) {
        viewModel.showDeletedOnly(deletedView)
        viewModel.loadConversation(sender)
        if (!deletedView) viewModel.markAsRead(sender)
        viewModel.loadSenderDetails(sender)
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
            // The deleted view has no reply bar; saving its empty box would
            // wipe the real conversation's draft.
            if (!deletedView) viewModel.saveDraft(replyText)
        }
    }

    // Where to scroll when the thread changes. It used to jump to the bottom
    // on every change, yanking the user away from older messages they were
    // reading. Now: bottom on first load, after your own send, or when you
    // were already at the bottom; older messages loaded on top keep your place.
    var shownIds by remember(sender) { mutableStateOf<List<Long>>(emptyList()) }
    LaunchedEffect(conversation) {
        val previous = shownIds
        shownIds = conversation.map { it.id }
        if (conversation.isEmpty()) return@LaunchedEffect
        val last = conversation.size - 1
        val prepended =
            previous.isNotEmpty() &&
                conversation.first().id != previous.first() &&
                previous.first() in shownIds
        val lastVisible =
            listState.layoutInfo.visibleItemsInfo
                .lastOrNull()
                ?.index ?: -1
        val wasAtBottom = previous.isEmpty() || lastVisible >= previous.size - 2
        when {
            previous.isEmpty() -> listState.scrollToItem(last, SCROLL_TO_END_PX)
            prepended ->
                listState.scrollToItem(
                    shownIds.indexOf(previous.first()).coerceAtLeast(0) + listState.firstVisibleItemIndex,
                    listState.firstVisibleItemScrollOffset,
                )
            conversation.last().isOutgoing && conversation.last().id !in previous ->
                listState.animateScrollToItem(last, SCROLL_TO_END_PX)
            wasAtBottom -> listState.animateScrollToItem(last, SCROLL_TO_END_PX)
        }
    }

    // Scrolled to the top of what's loaded: fetch older messages.
    val canLoadOlder by viewModel.canLoadOlder.collectAsState()
    LaunchedEffect(listState, canLoadOlder) {
        snapshotFlow { listState.firstVisibleItemIndex }
            .collect { first -> if (first == 0 && canLoadOlder && conversation.isNotEmpty()) viewModel.loadOlder() }
    }

    // While this thread is on screen, new messages are marked read as they
    // arrive and don't raise a notification (see ActiveConversation).
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner, sender, deletedView) {
        val observer =
            LifecycleEventObserver { _, event ->
                when (event) {
                    Lifecycle.Event.ON_RESUME ->
                        if (!deletedView) {
                            ActiveConversation.opened(sender)
                            viewModel.setVisible(true)
                        }
                    Lifecycle.Event.ON_PAUSE -> {
                        ActiveConversation.closed(sender)
                        viewModel.setVisible(false)
                    }
                    else -> Unit
                }
            }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            ActiveConversation.closed(sender)
            viewModel.setVisible(false)
        }
    }

    val withSmsPermission = rememberSmsSendPermission()

    fun retryFailedMessage(msg: SmsMessage) {
        withSmsPermission { OutgoingSms.retry(context, msg) }
    }

    // Telcos, banks, e-wallets, Google and other big apps (built-in list), or an
    // organisation the backend registry verified. A trusted name is never
    // blocked (that would cut off the real sender's OTPs and notices), but it
    // doesn't vouch for the content either. See TrustedSenders.
    val isTrusted = TrustedSenders.isTrusted(sender, senderVerification?.familiarity)
    val hasSuspicious = !isTrusted && conversation.any { it.classification == Classification.SCAM }
    val hasUnknown = !isTrusted && conversation.any { it.classification == Classification.UNKNOWN }
    // Every text under a trusted name is still checked: the name can be faked
    // (SMS blasters / fake cell towers never pass through the telco), and the
    // real company's account or SMS gateway can be compromised and used to
    // send scams. Content that gives that away (SmsRiskSignals.spoofWarning), or
    // a message the model/heuristic flagged, gets a warning with Report --
    // never Block, which would also cut off the real sender.
    val spoofWarning =
        remember(conversation, isTrusted) {
            if (!isTrusted) {
                null
            } else {
                val incoming = conversation.asReversed().filter { !it.isOutgoing }
                incoming.firstNotNullOfOrNull { SmsRiskSignals.spoofWarning(sender, it.body) }
                    ?: if (incoming.any { it.classification.isFlagged }) {
                        context.getString(R.string.thread_trusted_flagged, contactName ?: sender)
                    } else {
                        null
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
        // Blocking a trusted name would also cut off the real company.
        val allowBlock = canBlock && !isTrusted
        val message =
            target
                ?: conversation.lastOrNull { it.classification.isFlagged }
                ?: conversation.lastOrNull { !it.isOutgoing }
        val currentLabel =
            when (message?.classification) {
                Classification.SAFE, Classification.UNVERIFIED -> "Ham"
                Classification.SPAM -> "Spam"
                Classification.SCAM -> "Scam"
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
                canBlock = allowBlock,
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
                summaryText = if (topic != null) "" else context.getString(R.string.thread_summary_too_short)
            }
            summaryLoading = false
        }
    }

    if (showAISummary) {
        AISummaryBottomSheet(
            isSuspicious = hasSuspicious || hasUnknown || spoofWarning != null,
            isTrusted = isTrusted && spoofWarning == null,
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

    // Recently Deleted: leave once everything here has been recovered or deleted.
    var deletedLoaded by remember { mutableStateOf(false) }
    LaunchedEffect(isLoading, conversation.isEmpty()) {
        if (!deletedView || isLoading) return@LaunchedEffect
        if (conversation.isNotEmpty()) {
            deletedLoaded = true
        } else if (deletedLoaded) {
            navController.popBackStack()
        }
    }

    permanentDeleteIds?.let { ids ->
        AlertDialog(
            onDismissRequest = { permanentDeleteIds = null },
            containerColor = SurfaceElevated,
            title = {
                Text(pluralStringResource(R.plurals.messages_delete_forever_title, ids.size, ids.size), color = White)
            },
            text = { Text(stringResource(R.string.deleted_delete_forever_detail), color = TextSecondary) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deletePermanently(ids)
                    permanentDeleteIds = null
                }) { Text(stringResource(R.string.deleted_delete_forever), color = Danger) }
            },
            dismissButton = {
                TextButton(onClick = { permanentDeleteIds = null }) {
                    Text(stringResource(R.string.action_cancel), color = TextSecondary)
                }
            },
        )
    }

    // From pixels, not Configuration.screenWidthDp: BantAITheme rescales dp
    // on very narrow and very wide phones, and screenWidthDp doesn't know.
    val screenWidthPx = LocalContext.current.resources.displayMetrics.widthPixels
    val screenWidth = with(LocalDensity.current) { screenWidthPx.toDp() }
    val bubbleMaxWidth = screenWidth * 0.75f

    Box(Modifier.fillMaxSize()) {
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
                        Icon(
                            Icons.Filled.Close,
                            contentDescription = stringResource(R.string.action_cancel),
                            tint = White,
                        )
                    }
                    Text(
                        if (selectedIds.isEmpty()) {
                            stringResource(R.string.messages_select)
                        } else {
                            stringResource(R.string.messages_selected_count, selectedIds.size)
                        },
                        color = White,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = TextSize.Headline,
                        modifier = Modifier.weight(1f).padding(start = 4.dp),
                    )
                    TextButton(onClick = { viewModel.selectAll(conversation.map { it.id }) }) {
                        Text(
                            stringResource(R.string.message_detail_select_all),
                            color = IosBlue,
                            fontSize = TextSize.Subhead,
                        )
                    }
                    val reportTarget = conversation.singleOrNull { it.id in selectedIds }?.takeIf { !it.isOutgoing }
                    if (deletedView) {
                        IconButton(onClick = { viewModel.recover(selectedIds) }, enabled = selectedIds.isNotEmpty()) {
                            Icon(
                                Icons.Filled.Restore,
                                contentDescription = stringResource(R.string.deleted_recover),
                                tint = if (selectedIds.isNotEmpty()) IosBlue else TextTertiary,
                            )
                        }
                        IconButton(onClick = { permanentDeleteIds = selectedIds }, enabled = selectedIds.isNotEmpty()) {
                            Icon(
                                Icons.Outlined.Delete,
                                contentDescription = stringResource(R.string.deleted_delete_forever),
                                tint = if (selectedIds.isNotEmpty()) Danger else TextTertiary,
                            )
                        }
                    } else {
                        IconButton(
                            onClick = {
                                viewModel.exitSelectionMode()
                                openReport(reportTarget, action = "report")
                            },
                            enabled = reportTarget != null && selectedIds.size == 1,
                        ) {
                            Icon(
                                Icons.Outlined.ReportGmailerrorred,
                                contentDescription = stringResource(R.string.message_detail_report_message),
                                tint = if (reportTarget != null && selectedIds.size == 1) White else TextTertiary,
                            )
                        }
                    }
                    if (!deletedView) {
                        IconButton(onClick = { permanentDeleteIds = selectedIds }, enabled = selectedIds.isNotEmpty()) {
                            Icon(
                                Icons.Outlined.Delete,
                                contentDescription = stringResource(R.string.action_delete),
                                tint = if (selectedIds.isNotEmpty()) Danger else TextTertiary,
                            )
                        }
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
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.action_back),
                            tint = White,
                        )
                    }
                    Column(
                        modifier =
                            Modifier
                                .align(Alignment.Center)
                                .padding(horizontal = 100.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(
                            text = contactName ?: sender,
                            color = White,
                            fontWeight = FontWeight.Bold,
                            fontSize = TextSize.Body,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        // Same color rule as Alerts: red = likely scam, orange = suspicious.
                        if (deletedView) {
                            Text(
                                stringResource(R.string.messages_filter_deleted_title),
                                color = TextSecondary,
                                fontSize = TextSize.Footnote,
                            )
                        } else if (hasSuspicious) {
                            Text(
                                stringResource(R.string.verdict_likely_scam),
                                color = Danger,
                                fontSize = TextSize.Footnote,
                            )
                        } else if (hasUnknown) {
                            Text(
                                stringResource(R.string.verdict_suspicious),
                                color = SuspiciousText,
                                fontSize = TextSize.Footnote,
                            )
                        } else if (spoofWarning != null) {
                            Text(
                                stringResource(R.string.thread_trusted_check),
                                color = SuspiciousText,
                                fontSize = TextSize.Footnote,
                            )
                        } else if (isTrusted && senderVerification?.familiarity != "verified_organization") {
                            Text(
                                stringResource(R.string.thread_trusted_sender),
                                color = IosBlue,
                                fontSize = TextSize.Footnote,
                            )
                        } else if (senderVerification?.risk == "confirmed_fraud") {
                            Text(
                                stringResource(R.string.thread_confirmed_fraud),
                                color = Danger,
                                fontSize = TextSize.Footnote,
                            )
                        } else if (senderVerification?.risk == "external_high_risk") {
                            // Flagged by the backend's outside phone-reputation
                            // lookup, not by BantAI staff -- a caution, not a verdict.
                            Text(
                                stringResource(R.string.thread_external_high_risk),
                                color = SuspiciousText,
                                fontSize = TextSize.Footnote,
                            )
                        } else if (senderVerification?.familiarity == "verified_organization") {
                            Text(
                                stringResource(R.string.thread_verified_org) +
                                    (senderVerification?.organizationName?.let { " • $it" } ?: ""),
                                color = IosBlue,
                                fontSize = TextSize.Footnote,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        } else if (senderVerification?.familiarity == "known_contact") {
                            Text(
                                stringResource(R.string.thread_known_contact),
                                color = IosBlue,
                                fontSize = TextSize.Footnote,
                            )
                        }
                    }
                    if (!deletedView) {
                        Row(modifier = Modifier.align(Alignment.CenterEnd)) {
                            IconButton(onClick = { showAISummary = true }) {
                                Icon(
                                    Icons.Outlined.AutoAwesome,
                                    contentDescription = stringResource(R.string.ai_summary_bottom_sheet_ai_summary),
                                    tint = Indigo,
                                )
                            }
                            // A group can't be blocked or reported as a whole; each
                            // message's long-press menu still reports its own sender.
                            if (!isGroup) {
                                ThreadMenu(
                                    enabled = conversation.any { !it.isOutgoing },
                                    onReport = { openReport(action = "report") },
                                    onBlock = if (isTrusted) null else ({ openReport(action = "block") }),
                                )
                            }
                        }
                    }
                }
            }

            HorizontalDivider(color = Surface)

            // Suspicious warning -- goes straight to Take Action (Report/Block)
            // rather than the disabled-action ThreatAnalysisScreen; see
            // MessageDetailViewModel.flaggedMessageId for why this needs its own lookup.
            // A trusted sender gets the spoofWarning banner instead (hasSuspicious/hasUnknown are false).
            if (deletedView) {
                // No verdict banners here: these messages are on their way out.
            } else if (hasSuspicious || hasUnknown) {
                ThreadWarningBanner(
                    text =
                        stringResource(
                            if (hasSuspicious) R.string.thread_banner_scam else R.string.thread_banner_suspicious,
                        ),
                    actionLabel = stringResource(R.string.thread_banner_review),
                    tint = if (hasSuspicious) Danger else Suspicious,
                    actionColor = if (hasSuspicious) Danger else SuspiciousText,
                    onClick = { openReport() },
                )
            } else if (spoofWarning != null) {
                ThreadWarningBanner(
                    text = spoofWarning,
                    actionLabel = stringResource(R.string.thread_banner_report),
                    tint = Suspicious,
                    actionColor = SuspiciousText,
                    onClick = { openReport(action = "report", canBlock = false) },
                )
            }

            // Conversation thread
            if (isLoading) {
                ChatThreadSkeleton(modifier = Modifier.weight(1f).fillMaxWidth())
            } else if (errorMessage != null) {
                Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    StateMessage(
                        icon = Icons.Outlined.CloudOff,
                        title = stringResource(R.string.thread_load_failed),
                        detail = errorMessage,
                        actionLabel = stringResource(R.string.action_retry),
                        onAction = { viewModel.loadConversation(sender) },
                    )
                }
            } else if (conversation.isEmpty()) {
                Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    StateMessage(
                        icon = Icons.Outlined.Inbox,
                        title = stringResource(R.string.thread_empty_title),
                        detail = stringResource(R.string.thread_empty_detail),
                    )
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
                    itemsIndexed(conversation, key = { _, m -> m.id }) { index, msg ->
                        if (index == 0 || !MessageTime.sameDay(conversation[index - 1].timestamp, msg.timestamp)) {
                            DayDivider(MessageTime.dayLabel(context, msg.timestamp))
                        }
                        MessageRow(
                            msg = msg,
                            selectionMode = selectionMode,
                            isSelected = msg.id in selectedIds,
                            isTrusted = isTrusted,
                            bubbleMaxWidth = bubbleMaxWidth,
                            quote = replyQuotes[msg.id],
                            otherPartyName = contactName ?: sender,
                            showDelivered = msg.delivered && msg.id == lastOutgoingId,
                            senderLabel =
                                if (isGroup && !msg.isOutgoing) {
                                    memberNames[normalizeSenderKey(msg.sender)] ?: msg.sender
                                } else {
                                    null
                                },
                            onClick = {
                                when {
                                    selectionMode -> viewModel.toggleSelected(msg.id)
                                    msg.mmsDownload?.state == MmsDownloadState.FAILED ->
                                        viewModel.retryMmsDownload(msg.id)
                                }
                            },
                            hidden = focused?.message?.id == msg.id,
                            onLongClick = { bounds ->
                                if (!selectionMode) {
                                    haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                                    focused = FocusedMessage(msg, bounds)
                                }
                            },
                            onRetry = { retryFailedMessage(msg) },
                        )
                    }
                }
            }

            // Reply bar -- an alphanumeric sender ID (e.g. "GCash", "PLDTHome") has no
            // SMS return path at all, so replying would always fail after SmsSender's
            // 20s timeout with no way to succeed; show a disabled notice instead.
            // Service short codes (8080, 3733) do take replies, with a load caution.
            if (deletedView) {
                DeletedActionsBar(
                    onRecover = { viewModel.recover(conversation.map { it.id }) },
                    onDelete = { permanentDeleteIds = conversation.map { it.id }.toSet() },
                    enabled = conversation.isNotEmpty(),
                )
            } else if (isValidSmsRecipient(sender) || isGroup) {
                if (replyKindFor(sender) == SenderReplyKind.SERVICE_CODE) {
                    val purpose =
                        serviceCodeLabel(sender)?.let {
                            stringResource(R.string.thread_service_code_purpose, sender, it)
                        }
                            ?: stringResource(R.string.thread_service_code_generic, sender)
                    Text(
                        purpose + " " + stringResource(R.string.thread_service_code_warning),
                        color = TextSecondary,
                        fontSize = TextSize.Footnote,
                        lineHeight = 17.sp,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
                    )
                }
                ReplyBar(
                    sender = sender,
                    replyText = replyText,
                    onReplyTextChange = { replyText = it },
                    viewModel = viewModel,
                    warnBeforeSending = hasSuspicious,
                    subId = conversation.lastOrNull { !it.isOutgoing }?.subId ?: -1,
                    replyingTo = replyingTo,
                    replyingToName = replyingTo?.let { if (it.isOutgoing) null else contactName ?: sender },
                    onCancelReply = { replyingTo = null },
                )
            } else {
                UnreachableSenderNotice(sender)
            }
        }

        focused?.let { current ->
            val msg = current.message
            FocusedMessageOverlay(
                focused = current,
                actions =
                    messageActions(
                        message = msg,
                        canReply = !deletedView && (isValidSmsRecipient(sender) || isGroup),
                        canReport = !deletedView && !msg.isOutgoing,
                        onReply = { replyingTo = msg },
                        onCopy = {
                            clipboard.setText(AnnotatedString(shareableText(msg)))
                            Toast.makeText(context, R.string.thread_copied, Toast.LENGTH_SHORT).show()
                        },
                        onForward = { navController.navigate(Screen.Compose.createRoute(body = shareableText(msg))) },
                        onReport = { openReport(msg, action = "report") },
                        onSelect = { viewModel.enterSelectionMode(msg.id) },
                        onRetry = { retryFailedMessage(msg) },
                        onDelete = { permanentDeleteIds = setOf(msg.id) },
                    ),
                onDismiss = { focused = null },
            ) {
                MessageBubble(
                    msg = msg,
                    isTrusted = isTrusted,
                    bubbleMaxWidth = bubbleMaxWidth,
                    quote = replyQuotes[msg.id],
                    otherPartyName = contactName ?: sender,
                    onImageLongClick = {},
                )
            }
        }
    }
}
