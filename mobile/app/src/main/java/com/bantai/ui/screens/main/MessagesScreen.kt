package com.bantai.ui.screens.main

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Restore
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Inbox
import androidx.compose.material.icons.outlined.Sms
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
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
import com.bantai.container
import com.bantai.data.ContactsSync
import com.bantai.data.model.Classification
import com.bantai.data.model.ConversationView
import com.bantai.data.model.SmsMessage
import com.bantai.data.model.isGroupKey
import com.bantai.navigation.Screen
import com.bantai.ui.components.BadgeType
import com.bantai.ui.components.BantaiAlertDialog
import com.bantai.ui.components.CoachIds
import com.bantai.ui.components.CoachStep
import com.bantai.ui.components.CoachTour
import com.bantai.ui.components.CoachTourLauncher
import com.bantai.ui.components.FilterPill
import com.bantai.ui.components.GlassIconButton
import com.bantai.ui.components.ListSkeleton
import com.bantai.ui.components.LocalCoachMarks
import com.bantai.ui.components.MessageItem
import com.bantai.ui.components.SenderAvatar
import com.bantai.ui.components.StateMessage
import com.bantai.ui.components.SwipeActionsRow
import com.bantai.ui.components.SwipeGroupScope
import com.bantai.ui.components.coachTarget
import com.bantai.ui.components.getAvatarColor
import com.bantai.ui.components.getInitialsFromSender
import com.bantai.ui.components.swipeActionFor
import com.bantai.ui.theme.BantaiShapes
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.IosBlue
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.SuspiciousText
import com.bantai.ui.theme.TabTitleTopSpacing
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White
import com.bantai.ui.theme.glassSurface
import com.bantai.util.MessageTime
import com.bantai.util.SmsLinkSafety
import com.bantai.util.SmsWriteAccess
import com.bantai.util.TrustedSenders
import com.bantai.util.isResumed
import com.bantai.viewmodel.CheckProgress
import com.bantai.viewmodel.MessageFilter
import com.bantai.viewmodel.MessagesViewModel
import com.bantai.viewmodel.conversationViewFor
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import com.google.accompanist.permissions.shouldShowRationale

@OptIn(ExperimentalPermissionsApi::class, ExperimentalFoundationApi::class)
@Composable
fun MessagesScreen(
    navController: NavController,
    innerPadding: PaddingValues,
    viewModel: MessagesViewModel = viewModel(),
) {
    val context = LocalContext.current
    val readSmsPermission = rememberPermissionState(android.Manifest.permission.READ_SMS)
    val readContactsPermission = rememberPermissionState(android.Manifest.permission.READ_CONTACTS)
    // Asked once on open. If the user says no, the list shows a way to grant it
    // instead of an endless skeleton or a bare error.
    var smsPermissionAsked by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        if (!readSmsPermission.status.isGranted) {
            smsPermissionAsked = true
            readSmsPermission.launchPermissionRequest()
        } else if (!readContactsPermission.status.isGranted) {
            readContactsPermission.launchPermissionRequest()
        }
    }

    // Once contacts are readable, let the backend know which senders are saved
    // contacts (pseudonymous numbers only) so it never auto-blocks them.
    LaunchedEffect(readContactsPermission.status.isGranted) {
        if (readContactsPermission.status.isGranted) {
            ContactsSync.syncIfDue(context)
            // Names only resolve once contacts are readable: regroup the list
            // now instead of on the next incoming text.
            viewModel.refreshContactNames()
        }
    }

    LaunchedEffect(readSmsPermission.status.isGranted) {
        if (readSmsPermission.status.isGranted) {
            viewModel.onPermissionGranted()
            if (!readContactsPermission.status.isGranted) {
                readContactsPermission.launchPermissionRequest()
            }
        }
    }

    val searchQuery by viewModel.searchQuery.collectAsState()
    val selectedFilter by viewModel.selectedFilter.collectAsState()
    val visibleMessages by viewModel.visibleMessages.collectAsState()
    val filterCounts by viewModel.filterCounts.collectAsState()
    val hideUnknown by viewModel.hideUnknown.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val selectionMode by viewModel.selectionMode.collectAsState()
    val selectedIds by viewModel.selectedIds.collectAsState()
    val checkingIds by viewModel.checkingIds.collectAsState()
    val checkProgress by viewModel.checkProgress.collectAsState()

    var showDeleteConfirm by remember { mutableStateOf(false) }
    var showPermanentDeleteConfirm by remember { mutableStateOf(false) }
    var showRestoreConfirm by remember { mutableStateOf(false) }

    // Back should never fall through to exiting the screen: while selecting, back
    // cancels the selection; while on a non-default filter (Spam, Unknown, Recently
    // Deleted, Unread), back returns to Messages instead of leaving the tab entirely.
    // Only while Messages is the tab on screen: tabs stay composed in the
    // background (MainScreen), and this mustn't swallow Back on another tab.
    val tabActive = LocalTabActive.current
    BackHandler(enabled = tabActive && (selectionMode || selectedFilter != MessageFilter.MESSAGES)) {
        if (selectionMode) {
            viewModel.exitSelectionMode()
        } else {
            viewModel.setFilter(MessageFilter.MESSAGES)
        }
    }

    val prefs = context.container.userPreferences
    val showScamWaves by prefs.showScamWavesTab.collectAsState(initial = false)
    // "Help improve scam detection" off: flagged rows swipe to Block only.
    val shareReports by context.container.shareReports
        .collectAsState()
    CoachTourLauncher(mainTour(showScamWaves, hideUnknown, shareReports), enabled = tabActive && !isLoading)
    val coachStep = LocalCoachMarks.current?.currentTarget
    LaunchedEffect(coachStep) {
        if (coachStep == null) return@LaunchedEffect
        if (selectionMode) viewModel.exitSelectionMode()
        coachFilterFor(coachStep)?.let { viewModel.setFilter(it) }
    }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black)
                .statusBarsPadding(),
    ) {
        Spacer(Modifier.height(TabTitleTopSpacing))

        if (selectionMode) {
            SelectionTopBar(
                selectedCount = selectedIds.size,
                isRecentlyDeleted = selectedFilter == MessageFilter.RECENTLY_DELETED,
                onCancel = { viewModel.exitSelectionMode() },
                onSelectAll = { viewModel.selectAll() },
                onDelete = { showDeleteConfirm = true },
                onRestore = { showRestoreConfirm = true },
                onPermanentDelete = { showPermanentDeleteConfirm = true },
            )
        } else {
            // iOS-style large title with the filter bubble on the right
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    stringResource(selectedFilter.titleRes()),
                    color = White,
                    fontWeight = FontWeight.Bold,
                    fontSize = TextSize.LargeTitle,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                // Same control as Alerts' title.
                val hasUnread = visibleMessages.any { !it.isRead && !it.isOutgoing }
                if (hasUnread && selectedFilter != MessageFilter.RECENTLY_DELETED) {
                    Text(
                        stringResource(R.string.alerts_mark_all_read),
                        color = IosBlue,
                        fontSize = TextSize.Body,
                        modifier =
                            Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .clickable { viewModel.markAllRead() }
                                .padding(8.dp),
                    )
                }
            }

            Spacer(Modifier.height(12.dp))

            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                SearchPill(
                    value = searchQuery,
                    onValueChange = { viewModel.updateSearchQuery(it) },
                    modifier = Modifier.weight(1f).coachTarget(CoachIds.SEARCH),
                )
                Spacer(Modifier.width(4.dp))
                GlassIconButton(
                    icon = Icons.Filled.Edit,
                    contentDescription = stringResource(R.string.messages_new),
                    onClick = { navController.navigate(Screen.Compose.createRoute()) },
                )
            }

            Spacer(Modifier.height(10.dp))
            FilterChipsRow(
                selected = selectedFilter,
                counts = filterCounts,
                hideUnknown = hideUnknown,
                onSelect = { viewModel.setFilter(it) },
            )
            if (selectedFilter == MessageFilter.RECENTLY_DELETED) {
                // Retention.RECENTLY_DELETED_DAYS, so nothing vanishes unannounced.
                Text(
                    stringResource(R.string.retention_recently_deleted),
                    color = TextSecondary,
                    fontSize = TextSize.Footnote,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 6.dp),
                )
            }
            SmsWriteBlockedBanner()
        }

        Spacer(Modifier.height(6.dp))

        // One list for every filter, switched in place like Mail. It used to
        // cross-fade between two lists, but both halves read the new filter's
        // rows, so each switch built and drew the same list twice for nothing.
        // A fresh scroll state per filter starts each one at the top. Saveable,
        // so opening a conversation and coming back keeps the place in the list
        // (plain remember was dropped with the screen and reset it to the top).
        run {
            val tabMessages = visibleMessages
            val listState = rememberSaveable(selectedFilter, saver = LazyListState.Saver) { LazyListState() }
            SwipeGroupScope(scrolling = listState.isScrollInProgress) {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = innerPadding,
                ) {
                    if (!readSmsPermission.status.isGranted && smsPermissionAsked) {
                        item {
                            StateMessage(
                                modifier = Modifier.fillParentMaxHeight(EMPTY_STATE_HEIGHT),
                                icon = Icons.Outlined.Sms,
                                title = stringResource(R.string.messages_permission_title),
                                detail = stringResource(R.string.messages_permission_detail),
                                // Once Android stops showing the prompt ("Don't ask
                                // again"), only the app's settings page can grant it.
                                actionLabel =
                                    stringResource(
                                        if (readSmsPermission.status.shouldShowRationale) {
                                            R.string.messages_permission_allow
                                        } else {
                                            R.string.action_open_settings
                                        },
                                    ),
                                onAction = {
                                    if (readSmsPermission.status.shouldShowRationale) {
                                        readSmsPermission.launchPermissionRequest()
                                    } else {
                                        openAppSettings(context)
                                    }
                                },
                            )
                        }
                    } else if (isLoading) {
                        item { ListSkeleton(rows = 6) }
                    } else if (errorMessage != null) {
                        item {
                            StateMessage(
                                modifier = Modifier.fillParentMaxHeight(EMPTY_STATE_HEIGHT),
                                icon = Icons.Outlined.CloudOff,
                                title = stringResource(R.string.messages_load_failed),
                                detail = errorMessage,
                                actionLabel = stringResource(R.string.action_retry),
                                onAction = { viewModel.loadMessages() },
                            )
                        }
                    } else if (tabMessages.isEmpty()) {
                        item {
                            val (title, detail) = selectedFilter.emptyState(searching = searchQuery.isNotEmpty())
                            StateMessage(
                                modifier = Modifier.fillParentMaxHeight(EMPTY_STATE_HEIGHT),
                                icon = if (searchQuery.isNotEmpty()) Icons.Filled.Search else Icons.Outlined.Inbox,
                                title = stringResource(title),
                                detail = stringResource(detail),
                            )
                        }
                    } else {
                        val isDraftsFilter = selectedFilter == MessageFilter.DRAFTS
                        checkProgress?.let { progress ->
                            item(key = "checking-banner", contentType = "checking-banner") { CheckingBanner(progress) }
                        }
                        // Stable keys: a new message or a read receipt updates its own
                        // row instead of recomposing every row below it.
                        items(tabMessages, key = { "${it.sender}|${it.id}" }, contentType = { "conversation" }) { msg ->
                            val draftPrefix = stringResource(R.string.messages_draft_prefix)
                            val unreadSummaryPrefix = stringResource(R.string.messages_unread_summary_prefix)
                            // Remembered per row: building it runs the link/spoof regexes
                            // and date formatting, which used to repeat for every row on
                            // every recomposition (each filter switch, each new message).
                            // Not classified yet but on its way: queued in the scan,
                            // waiting on a live verdict, or in the history sort.
                            val awaitingHistorySort =
                                checkProgress?.sortingHistory == true && msg.classification == Classification.UNVERIFIED
                            val checking =
                                !isDraftsFilter && !msg.isOutgoing && (msg.id in checkingIds || awaitingHistorySort)
                            val item =
                                remember(msg, isDraftsFilter, checking) {
                                    msg
                                        .toDisplayItem(
                                            context = context,
                                            isDraft = isDraftsFilter,
                                            draftPrefix = draftPrefix,
                                            unreadSummaryPrefix = unreadSummaryPrefix,
                                        ).let {
                                            // Only a row with no verdict yet becomes "Checking…".
                                            // A re-check of a row already marked Scam/Suspicious
                                            // must keep showing that warning until it changes.
                                            if (checking && it.badge == BadgeType.UNVERIFIED) {
                                                it.copy(badge = BadgeType.CHECKING)
                                            } else {
                                                it
                                            }
                                        }
                                }
                            // Flagged threads (Spam, Unknown) swipe left to Report or
                            // Block, like a To Review alert; real messages don't. A group
                            // can't be blocked (the thread screen forbids it too).
                            val canBlockThread = !TrustedSenders.isBuiltIn(msg.sender) && !isGroupKey(msg.sender)
                            SwipeActionsRow(
                                key = msg.id,
                                enabled =
                                    !selectionMode && selectedFilter in SWIPEABLE_FILTERS && !msg.isOutgoing,
                                action = swipeActionFor(canBlock = canBlockThread, reportsOn = shareReports),
                                background = Black,
                                onAction = { action ->
                                    if (!navController.isResumed()) return@SwipeActionsRow
                                    navController.navigate(
                                        Screen.TakeAction.createRoute(
                                            sender = msg.sender,
                                            localId = msg.id.takeIf { it > 0 },
                                            action = action,
                                            canBlock = canBlockThread,
                                        ),
                                    )
                                },
                            ) {
                                MessageListRow(
                                    item = item,
                                    selectionMode = selectionMode,
                                    isSelected = msg.id in selectedIds,
                                    onClick = {
                                        when {
                                            selectionMode -> viewModel.toggleSelected(msg.id)
                                            // Resume editing instead of opening a conversation —
                                            // a draft may not even have any real messages yet.
                                            isDraftsFilter ->
                                                navController.navigate(
                                                    Screen.Compose.createRoute(recipient = msg.sender, body = msg.body),
                                                )
                                            // A row whose latest message is the user's own is a
                                            // conversation they're part of: open all of it, or a
                                            // friend's replies filed as Unknown would be missing.
                                            msg.isOutgoing ->
                                                navController.navigate(
                                                    Screen.Detail.createRoute(msg.sender, ConversationView.ALL),
                                                )
                                            else ->
                                                navController.navigate(
                                                    Screen.Detail.createRoute(
                                                        msg.sender,
                                                        conversationViewFor(selectedFilter),
                                                    ),
                                                )
                                        }
                                    },
                                    onLongClick = {
                                        // Drafts aren't real provider rows, so the delete/restore
                                        // selection flow (built around real message ids) doesn't
                                        // apply — discard a draft by opening and clearing it instead.
                                        if (!selectionMode && !isDraftsFilter) viewModel.enterSelectionMode(msg.id)
                                    },
                                )
                            }
                            HorizontalDivider(
                                color = Hairline,
                                thickness = 0.5.dp,
                                // Aligned with the text column (gutter + avatar + gap), as in iOS.
                                modifier = Modifier.padding(start = 80.dp),
                            )
                        }
                    }
                }
            }
        }
    }

    if (showDeleteConfirm) {
        val count = selectedIds.size
        BantaiAlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text(pluralStringResource(R.plurals.messages_delete_title, count, count), color = White) },
            text = { Text(stringResource(R.string.message_detail_they_ll_move_to_recently), color = TextSecondary) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deleteSelected()
                    showDeleteConfirm = false
                }) { Text(stringResource(R.string.action_delete), color = Danger) }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) {
                    Text(
                        stringResource(R.string.action_cancel),
                        color = TextSecondary,
                    )
                }
            },
        )
    }

    if (showRestoreConfirm) {
        val count = selectedIds.size
        BantaiAlertDialog(
            onDismissRequest = { showRestoreConfirm = false },
            title = { Text(pluralStringResource(R.plurals.messages_restore_title, count, count), color = White) },
            text = { Text(stringResource(R.string.messages_they_ll_move_back_to), color = TextSecondary) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.restoreSelected()
                    showRestoreConfirm = false
                }) { Text(stringResource(R.string.messages_restore), color = Indigo) }
            },
            dismissButton = {
                TextButton(onClick = { showRestoreConfirm = false }) {
                    Text(
                        stringResource(R.string.action_cancel),
                        color = TextSecondary,
                    )
                }
            },
        )
    }

    if (showPermanentDeleteConfirm) {
        val count = selectedIds.size
        BantaiAlertDialog(
            onDismissRequest = { showPermanentDeleteConfirm = false },
            title = {
                Text(pluralStringResource(R.plurals.messages_delete_forever_title, count, count), color = White)
            },
            text = { Text(stringResource(R.string.messages_this_can_t_be_undone), color = TextSecondary) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.permanentlyDeleteSelected()
                    showPermanentDeleteConfirm = false
                }) { Text(stringResource(R.string.messages_delete_permanently), color = Danger) }
            },
            dismissButton = {
                TextButton(onClick = { showPermanentDeleteConfirm = false }) {
                    Text(
                        stringResource(R.string.action_cancel),
                        color = TextSecondary,
                    )
                }
            },
        )
    }
}

@Composable
private fun SelectionTopBar(
    selectedCount: Int,
    isRecentlyDeleted: Boolean,
    onCancel: () -> Unit,
    onSelectAll: () -> Unit,
    onDelete: () -> Unit,
    onRestore: () -> Unit,
    onPermanentDelete: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onCancel) {
            Icon(Icons.Filled.Close, contentDescription = stringResource(R.string.action_cancel), tint = White)
        }
        Text(
            if (selectedCount == 0) {
                stringResource(R.string.messages_select)
            } else {
                stringResource(R.string.messages_selected_count, selectedCount)
            },
            color = White,
            fontWeight = FontWeight.SemiBold,
            fontSize = TextSize.Headline,
            modifier = Modifier.weight(1f).padding(start = 4.dp),
        )
        TextButton(onClick = onSelectAll) {
            Text(stringResource(R.string.message_detail_select_all), color = IosBlue, fontSize = TextSize.Subhead)
        }
        if (isRecentlyDeleted) {
            IconButton(onClick = onRestore, enabled = selectedCount > 0) {
                Icon(
                    Icons.Filled.Restore,
                    contentDescription = stringResource(R.string.messages_restore),
                    tint = if (selectedCount > 0) White else TextTertiary,
                )
            }
            IconButton(onClick = onPermanentDelete, enabled = selectedCount > 0) {
                Icon(
                    Icons.Filled.Delete,
                    contentDescription = stringResource(R.string.messages_delete_permanently_2),
                    tint = if (selectedCount > 0) Danger else TextTertiary,
                )
            }
        } else {
            IconButton(onClick = onDelete, enabled = selectedCount > 0) {
                Icon(
                    Icons.Filled.Delete,
                    contentDescription = stringResource(R.string.action_delete),
                    tint = if (selectedCount > 0) Danger else TextTertiary,
                )
            }
        }
    }
}

// The two prefixes are passed in (already localized) since this isn't a composable.
private fun SmsMessage.toDisplayItem(
    context: android.content.Context,
    isDraft: Boolean,
    draftPrefix: String,
    unreadSummaryPrefix: String,
) = MessageItem(
    sender = sender,
    title = displayName ?: sender,
    initials = getInitialsFromSender(displayName ?: sender),
    avatarColor = getAvatarColor(sender),
    preview =
        when {
            isDraft -> "$draftPrefix $body"
            isUnreadThreadSummary -> "$unreadSummaryPrefix $body"
            else -> SmsLinkSafety.visibleBody(body, classification, sender)
        },
    timestamp = MessageTime.listLabel(context, timestamp),
    badge =
        when (classification) {
            Classification.SPAM -> BadgeType.SPAM
            Classification.SCAM -> BadgeType.BLOCKED
            Classification.SAFE -> BadgeType.SAFE
            Classification.UNVERIFIED -> BadgeType.UNVERIFIED
            else -> BadgeType.UNKNOWN
        },
    isRead = isRead,
)

@Composable
private fun SearchPill(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .height(38.dp)
                .background(SurfaceElevated, BantaiShapes.Small)
                .padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            Icons.Default.Search,
            contentDescription = null,
            tint = TextSecondary,
            modifier = Modifier.size(18.dp),
        )
        Spacer(Modifier.width(6.dp))
        Box(modifier = Modifier.weight(1f)) {
            if (value.isEmpty()) {
                Text(stringResource(R.string.messages_search), color = TextSecondary, fontSize = TextSize.Body)
            }
            val searchLabel = stringResource(R.string.messages_search)
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                textStyle = TextStyle(color = White, fontSize = TextSize.Body),
                singleLine = true,
                // The visible hint above isn't part of the field, so TalkBack
                // only said "edit box".
                modifier = Modifier.fillMaxWidth().semantics { contentDescription = searchLabel },
            )
        }
        if (value.isNotEmpty()) {
            Icon(
                Icons.Filled.Cancel,
                contentDescription = stringResource(R.string.action_clear_search),
                tint = TextTertiary,
                modifier =
                    Modifier
                        .size(28.dp)
                        .clip(CircleShape)
                        .clickable { onValueChange("") }
                        .padding(5.dp),
            )
        }
    }
}

// Spam and Unknown hold the flagged threads; only those swipe to Report/Block.
private val SWIPEABLE_FILTERS = setOf(MessageFilter.SPAM, MessageFilter.UNKNOWN)

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun MessageListRow(
    item: MessageItem,
    selectionMode: Boolean,
    isSelected: Boolean,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .combinedClickable(onClick = onClick, onLongClick = onLongClick)
                .padding(start = 8.dp, end = 12.dp, top = 12.dp, bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Unread indicator — iMessage-style blue dot in the gutter
        Box(modifier = Modifier.width(16.dp), contentAlignment = Alignment.Center) {
            if (!item.isRead) {
                Box(
                    modifier =
                        Modifier
                            .size(9.dp)
                            .background(IosBlue, CircleShape),
                )
            }
        }
        if (selectionMode) {
            Icon(
                imageVector = if (isSelected) Icons.Filled.CheckCircle else Icons.Outlined.Circle,
                contentDescription = stringResource(if (isSelected) R.string.cd_selected else R.string.cd_not_selected),
                tint = if (isSelected) Indigo else TextTertiary,
                modifier = Modifier.size(44.dp).padding(10.dp),
            )
        } else {
            // The review sign sits on the avatar's corner, so it lines up on
            // every row -- next to the time it shifted with each time's width
            // ("4:47 pm" vs "Yesterday") and the column looked like a wave.
            Box {
                SenderAvatar(sender = item.sender, size = 44.dp)
                ReviewBadge(item.badge, Modifier.align(Alignment.BottomEnd))
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    item.title,
                    color = White,
                    fontWeight = if (item.isRead) FontWeight.SemiBold else FontWeight.Bold,
                    fontSize = TextSize.Body,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    item.timestamp,
                    color = TextSecondary,
                    fontSize = TextSize.Footnote,
                )
                Icon(
                    Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint = TextTertiary,
                    modifier = Modifier.size(16.dp),
                )
            }
            Spacer(Modifier.height(2.dp))
            Text(
                item.preview,
                color = TextSecondary,
                fontSize = TextSize.Subhead,
                lineHeight = 19.sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

// The main filters as chips under the search bar, each with its conversation
// count. They used to hide behind a small filter icon, so most users never
// found Spam or Unknown at all. Drafts only appears when there are some.
@Composable
private fun FilterChipsRow(
    selected: MessageFilter,
    counts: Map<MessageFilter, Int>,
    hideUnknown: Boolean,
    onSelect: (MessageFilter) -> Unit,
) {
    val filters =
        buildList {
            add(MessageFilter.MESSAGES)
            add(MessageFilter.SPAM)
            if (!hideUnknown) add(MessageFilter.UNKNOWN)
            add(MessageFilter.UNREAD)
            if ((counts[MessageFilter.DRAFTS] ?: 0) > 0 || selected == MessageFilter.DRAFTS) add(MessageFilter.DRAFTS)
            add(MessageFilter.RECENTLY_DELETED)
        }
    // The chosen pill is scrolled into view, so a filter picked off to the
    // right (Deleted) or by the walkthrough is never hidden past the edge.
    val rowState = rememberLazyListState()
    LaunchedEffect(selected, filters.size) {
        val index = filters.indexOf(selected)
        if (index >= 0) rowState.animateScrollToItem(if (index <= 1) 0 else index - 1)
    }
    LazyRow(
        state = rowState,
        contentPadding = PaddingValues(horizontal = 20.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(filters) { filter ->
            // Same pill as Alerts' To review / Reported / Blocked, no counts. The
            // spotlight target sits on the whole pill, padding included.
            FilterPill(
                label = stringResource(filter.chipRes()),
                selected = filter == selected,
                onClick = { onSelect(filter) },
                modifier = Modifier.coachTarget(filter.coachId()),
            )
        }
    }
}

private fun MessageFilter.coachId(): String =
    when (this) {
        MessageFilter.MESSAGES -> CoachIds.FILTER_ALL
        MessageFilter.SPAM -> CoachIds.FILTER_SPAM
        MessageFilter.UNKNOWN -> CoachIds.FILTER_UNKNOWN
        else -> "filter_${name.lowercase()}"
    }

private fun MessageFilter.titleRes(): Int =
    when (this) {
        MessageFilter.MESSAGES -> R.string.messages_title
        MessageFilter.SPAM -> R.string.messages_filter_spam
        MessageFilter.UNKNOWN -> R.string.messages_filter_unknown
        MessageFilter.RECENTLY_DELETED -> R.string.messages_filter_deleted_title
        MessageFilter.UNREAD -> R.string.messages_filter_unread
        MessageFilter.DRAFTS -> R.string.messages_filter_drafts
    }

private fun MessageFilter.chipRes(): Int =
    when (this) {
        MessageFilter.MESSAGES -> R.string.messages_filter_all
        MessageFilter.RECENTLY_DELETED -> R.string.messages_filter_deleted
        else -> titleRes()
    }

/** Title and one line of explanation for an empty list under this filter. */
private fun MessageFilter.emptyState(searching: Boolean): Pair<Int, Int> =
    if (searching) {
        R.string.messages_empty_search_title to R.string.messages_empty_search_detail
    } else {
        when (this) {
            MessageFilter.MESSAGES -> R.string.messages_empty_title to R.string.messages_empty_detail
            MessageFilter.SPAM -> R.string.messages_empty_spam_title to R.string.messages_empty_spam_detail
            MessageFilter.UNKNOWN -> R.string.messages_empty_unknown_title to R.string.messages_empty_unknown_detail
            MessageFilter.RECENTLY_DELETED ->
                R.string.messages_empty_deleted_title to R.string.messages_empty_deleted_detail
            MessageFilter.UNREAD -> R.string.messages_empty_unread_title to R.string.messages_empty_unread_detail
            MessageFilter.DRAFTS -> R.string.messages_empty_drafts_title to R.string.messages_empty_drafts_detail
        }
    }

private fun openAppSettings(context: Context) {
    val intent =
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    runCatching { context.startActivity(intent) }
}

// Empty/error states fill this much of the list's height and center in it,
// so they sit in the visible middle rather than behind the floating tab bar.
private const val EMPTY_STATE_HEIGHT = 0.8f

// Shown when BantAI is the default SMS app but Android is silently dropping
// its writes (WRITE_SMS app-op left at "ignore"; see SmsWriteAccess). Without
// it, sent messages just never appear and nothing says why. Re-checked on
// every resume, so it goes away once the user has fixed it in Settings.
@Composable
private fun SmsWriteBlockedBanner() {
    val context = LocalContext.current
    var blocked by remember { mutableStateOf(SmsWriteAccess.isBlocked(context)) }
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer =
            LifecycleEventObserver { _, event ->
                if (event == Lifecycle.Event.ON_RESUME) blocked = SmsWriteAccess.isBlocked(context)
            }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    if (!blocked) return
    Column(
        modifier =
            Modifier
                .padding(start = 16.dp, end = 16.dp, top = 10.dp)
                .fillMaxWidth()
                .glassSurface()
                .clickable { runCatching { context.startActivity(SmsWriteAccess.fixIntent()) } }
                .padding(14.dp),
    ) {
        Text(
            stringResource(R.string.messages_write_blocked_title),
            color = White,
            fontWeight = FontWeight.SemiBold,
            fontSize = TextSize.Subhead,
        )
        Text(
            stringResource(R.string.messages_write_blocked_detail),
            color = TextSecondary,
            fontSize = TextSize.Footnote,
        )
        Text(
            stringResource(R.string.messages_write_blocked_fix),
            color = SuspiciousText,
            fontWeight = FontWeight.SemiBold,
            fontSize = TextSize.Footnote,
            modifier = Modifier.padding(top = 6.dp),
        )
    }
}

private const val MESSAGES_TAB = 0
private const val ALERTS_TAB = 1
private const val WAVES_TAB = 2
private const val SETTINGS_TAB = 3

// First-run walkthrough: what each inbox filter holds, search, then on into
// Alerts, Scam Waves (only when that tab is on) and Settings -- the tour opens
// each tab itself. Steps for things the user hid drop out.
private fun mainTour(
    showScamWaves: Boolean,
    hideUnknown: Boolean,
    shareReports: Boolean,
): CoachTour {
    val steps =
        buildList {
            add(step(CoachIds.FILTER_ALL, R.string.coach_all_title, R.string.coach_all_body))
            add(step(CoachIds.FILTER_SPAM, R.string.coach_spam_title, R.string.coach_spam_body))
            if (!hideUnknown) {
                add(step(CoachIds.FILTER_UNKNOWN, R.string.coach_unknown_title, R.string.coach_unknown_body))
            }
            add(step(CoachIds.SEARCH, R.string.coach_search_title, R.string.coach_search_body))
            add(step(CoachIds.TAB_ALERTS, R.string.coach_alerts_tab_title, R.string.coach_alerts_tab_body))
            // With reports off there's no Reported page (Alerts is one list,
            // so this points at its Today / This week / Earlier control), and
            // the swipe only blocks.
            val tabsTitle =
                if (shareReports) R.string.coach_alert_tabs_title else R.string.coach_alert_tabs_title_no_reports
            val tabsBody =
                if (shareReports) R.string.coach_alert_tabs_body else R.string.coach_alert_tabs_body_no_reports
            add(step(CoachIds.ALERT_TABS, tabsTitle, tabsBody, ALERTS_TAB))
            add(
                step(
                    CoachIds.ALERT_FIRST_ROW,
                    R.string.coach_alert_swipe_title,
                    if (shareReports) R.string.coach_alert_swipe_body else R.string.coach_alert_swipe_body_block,
                    ALERTS_TAB,
                ),
            )
            if (showScamWaves) {
                add(step(CoachIds.WAVES_TITLE, R.string.coach_waves_title, R.string.coach_waves_body, WAVES_TAB))
                add(
                    step(
                        CoachIds.WAVES_CHIPS,
                        R.string.coach_waves_chips_title,
                        R.string.coach_waves_chips_body,
                        WAVES_TAB,
                    ),
                )
            }
            addAll(SETTINGS_STEPS)
        }
    return CoachTour(key = "main_v2", steps = steps)
}

// The tour's last stops, in Settings: the switches a user is likeliest to want,
// then help. The Scam Waves and Unknown rows are there whether those tabs are
// on or off, so these steps also say where to bring back whatever was hidden.
private val SETTINGS_STEPS =
    listOf(
        CoachIds.SETTINGS_TITLE to (R.string.coach_settings_title to R.string.coach_settings_body),
        CoachIds.SETTINGS_WAVES to (R.string.coach_settings_waves_title to R.string.coach_settings_waves_body),
        CoachIds.SETTINGS_UNKNOWN to (R.string.coach_settings_unknown_title to R.string.coach_settings_unknown_body),
        CoachIds.SETTINGS_TIPS to (R.string.coach_settings_tips_title to R.string.coach_settings_tips_body),
        // Screen order: Privacy & data sits above Contact support.
        CoachIds.SETTINGS_PRIVACY to (R.string.coach_settings_privacy_title to R.string.coach_settings_privacy_body),
        CoachIds.SETTINGS_SUPPORT to (R.string.coach_settings_support_title to R.string.coach_settings_support_body),
    ).map { (target, text) -> step(target, text.first, text.second, SETTINGS_TAB) }

// Main-tour steps live on Messages unless they name another tab.
private fun step(
    target: String,
    title: Int,
    body: Int,
    tab: Int = MESSAGES_TAB,
) = CoachStep(target, title, body, tab)

// Which inbox page a walkthrough step shows; null leaves the page alone.
private fun coachFilterFor(step: String): MessageFilter? =
    when (step) {
        CoachIds.FILTER_ALL, CoachIds.SEARCH, CoachIds.TAB_ALERTS -> MessageFilter.MESSAGES
        CoachIds.FILTER_SPAM -> MessageFilter.SPAM
        CoachIds.FILTER_UNKNOWN -> MessageFilter.UNKNOWN
        else -> null
    }

// Only messages that need a second look get a marker; a "Safe" label on every
// row was noise. A trusted sender name gets one too: the name can be faked or
// the real account hacked. Drawn as a small badge on the avatar's corner.
@Composable
private fun ReviewBadge(
    badge: BadgeType,
    modifier: Modifier = Modifier,
) {
    if (badge != BadgeType.BLOCKED && badge != BadgeType.UNKNOWN) return
    val scam = badge == BadgeType.BLOCKED
    Box(
        modifier = modifier.offset(x = 3.dp, y = 3.dp).size(20.dp).background(Black, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            Icons.Outlined.WarningAmber,
            contentDescription =
                stringResource(if (scam) R.string.verdict_likely_scam else R.string.verdict_suspicious),
            tint = if (scam) Danger else Suspicious,
            modifier = Modifier.size(15.dp),
        )
    }
}

/** "Checking your messages… 120 of 900" while history is sorted or the inbox is scanned. */
@Composable
private fun CheckingBanner(progress: CheckProgress) {
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text(
            text =
                if (progress.total > 0) {
                    stringResource(R.string.messages_checking_progress, progress.done, progress.total)
                } else {
                    stringResource(R.string.messages_checking)
                },
            color = TextSecondary,
            fontSize = TextSize.Caption,
        )
        Spacer(Modifier.height(6.dp))
        if (progress.total > 0) {
            LinearProgressIndicator(
                progress = { progress.done.toFloat() / progress.total },
                modifier = Modifier.fillMaxWidth(),
            )
        } else {
            LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
        }
    }
}
