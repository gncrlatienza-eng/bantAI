package com.bantai.ui.screens.main

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
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
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.data.ContactsSync
import com.bantai.data.model.Classification
import com.bantai.data.model.ConversationView
import com.bantai.data.model.SmsMessage
import com.bantai.navigation.Screen
import com.bantai.ui.components.BadgeType
import com.bantai.ui.components.GlassIconButton
import com.bantai.ui.components.ListSkeleton
import com.bantai.ui.components.MessageItem
import com.bantai.ui.components.SenderAvatar
import com.bantai.ui.components.StateMessage
import com.bantai.ui.components.getAvatarColor
import com.bantai.ui.components.getInitialsFromSender
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.IosBlue
import com.bantai.ui.theme.OnIndigo
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.SuspiciousText
import com.bantai.ui.theme.TabTitleTopSpacing
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White
import com.bantai.util.MessageTime
import com.bantai.util.SmsLinkSafety
import com.bantai.util.SmsWriteAccess
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
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val selectionMode by viewModel.selectionMode.collectAsState()
    val selectedIds by viewModel.selectedIds.collectAsState()

    var showDeleteConfirm by remember { mutableStateOf(false) }
    var showPermanentDeleteConfirm by remember { mutableStateOf(false) }
    var showRestoreConfirm by remember { mutableStateOf(false) }

    // Back should never fall through to exiting the screen: while selecting, back
    // cancels the selection; while on a non-default filter (Spam, Unknown, Recently
    // Deleted, Unread), back returns to Messages instead of leaving the tab entirely.
    BackHandler(enabled = selectionMode || selectedFilter != MessageFilter.MESSAGES) {
        if (selectionMode) {
            viewModel.exitSelectionMode()
        } else {
            viewModel.setFilter(MessageFilter.MESSAGES)
        }
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
                    modifier = Modifier.weight(1f),
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
                onSelect = { viewModel.setFilter(it) },
            )
            SmsWriteBlockedBanner()
        }

        Spacer(Modifier.height(6.dp))

        AnimatedContent(
            targetState = selectedFilter,
            transitionSpec = {
                fadeIn(tween(250)) togetherWith fadeOut(tween(200))
            },
            label = "filter_switch",
        ) { _ ->
            val tabMessages = visibleMessages
            LazyColumn(
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
                    items(tabMessages) { msg ->
                        MessageListRow(
                            item =
                                msg.toDisplayItem(
                                    context = context,
                                    isDraft = isDraftsFilter,
                                    draftPrefix = stringResource(R.string.messages_draft_prefix),
                                    unreadSummaryPrefix = stringResource(R.string.messages_unread_summary_prefix),
                                ),
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
                                            Screen.Detail.createRoute(msg.sender, conversationViewFor(selectedFilter)),
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

    if (showDeleteConfirm) {
        val count = selectedIds.size
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            containerColor = SurfaceElevated,
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
        AlertDialog(
            onDismissRequest = { showRestoreConfirm = false },
            containerColor = SurfaceElevated,
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
        AlertDialog(
            onDismissRequest = { showPermanentDeleteConfirm = false },
            containerColor = SurfaceElevated,
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
                .background(SurfaceElevated, RoundedCornerShape(12.dp))
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
    }
}

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
            SenderAvatar(sender = item.sender, size = 44.dp)
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
                    fontWeight = FontWeight.Bold,
                    fontSize = TextSize.Body,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(8.dp))
                // Only messages that need a second look get a marker; a "Safe"
                // label on every row was noise. A trusted sender name gets one
                // too: the name can be faked or the real account hacked.
                val needsReview = item.badge == BadgeType.BLOCKED || item.badge == BadgeType.UNKNOWN
                if (needsReview) {
                    Icon(
                        Icons.Outlined.WarningAmber,
                        contentDescription =
                            stringResource(
                                if (item.badge == BadgeType.BLOCKED) {
                                    R.string.verdict_likely_scam
                                } else {
                                    R.string.verdict_suspicious
                                },
                            ),
                        tint = if (item.badge == BadgeType.BLOCKED) Danger else Suspicious,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(Modifier.width(4.dp))
                }
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
                maxLines = 1,
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
    onSelect: (MessageFilter) -> Unit,
) {
    val filters =
        buildList {
            add(MessageFilter.MESSAGES)
            add(MessageFilter.SPAM)
            add(MessageFilter.UNKNOWN)
            add(MessageFilter.UNREAD)
            if ((counts[MessageFilter.DRAFTS] ?: 0) > 0 || selected == MessageFilter.DRAFTS) add(MessageFilter.DRAFTS)
            add(MessageFilter.RECENTLY_DELETED)
        }
    LazyRow(
        contentPadding = PaddingValues(horizontal = 20.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(filters) { filter ->
            val isSelected = filter == selected
            val label = stringResource(filter.chipRes())
            Box(
                modifier =
                    Modifier
                        .heightIn(min = 36.dp)
                        .clip(RoundedCornerShape(100.dp))
                        .background(if (isSelected) Indigo else SurfaceElevated)
                        .clickable { onSelect(filter) }
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    label,
                    color = if (isSelected) OnIndigo else White,
                    fontSize = TextSize.Subhead,
                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                )
            }
        }
    }
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
                .clip(RoundedCornerShape(14.dp))
                .background(Suspicious.copy(alpha = 0.12f))
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
