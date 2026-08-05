package com.bantai.ui.screens.main

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
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.Restore
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import com.bantai.data.model.SmsMessage
import com.bantai.navigation.Screen
import com.bantai.ui.components.BadgeType
import com.bantai.ui.components.MessageItem
import com.bantai.ui.components.SenderAvatar
import com.bantai.ui.components.getAvatarColor
import com.bantai.ui.components.getInitialsFromSender
import com.bantai.ui.components.getRelativeTime
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.IosBlue
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White
import com.bantai.viewmodel.MessageFilter
import com.bantai.viewmodel.MessagesViewModel

@OptIn(ExperimentalPermissionsApi::class, ExperimentalFoundationApi::class)
@Composable
fun MessagesScreen(
    navController: NavController,
    innerPadding: PaddingValues,
    viewModel: MessagesViewModel = viewModel(),
) {
    val readSmsPermission = rememberPermissionState(android.Manifest.permission.READ_SMS)
    val readContactsPermission = rememberPermissionState(android.Manifest.permission.READ_CONTACTS)

    LaunchedEffect(Unit) {
        if (!readSmsPermission.status.isGranted) {
            readSmsPermission.launchPermissionRequest()
        } else if (!readContactsPermission.status.isGranted) {
            readContactsPermission.launchPermissionRequest()
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
    val isLoading by viewModel.isLoading.collectAsState()
    val selectionMode by viewModel.selectionMode.collectAsState()
    val selectedIds by viewModel.selectedIds.collectAsState()

    var showDeleteConfirm by remember { mutableStateOf(false) }
    var showPermanentDeleteConfirm by remember { mutableStateOf(false) }

    // Back should never fall through to exiting the screen: while selecting, back
    // cancels the selection; while on a non-default filter (Spam, Blocked, Recently
    // Deleted, Unread), back returns to Messages instead of leaving the tab entirely.
    BackHandler(enabled = selectionMode || selectedFilter != MessageFilter.MESSAGES) {
        if (selectionMode) viewModel.exitSelectionMode()
        else viewModel.setFilter(MessageFilter.MESSAGES)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Black)
            .statusBarsPadding(),
    ) {
        Spacer(Modifier.height(16.dp))

        if (selectionMode) {
            SelectionTopBar(
                selectedCount = selectedIds.size,
                isRecentlyDeleted = selectedFilter == MessageFilter.RECENTLY_DELETED,
                onCancel = { viewModel.exitSelectionMode() },
                onSelectAll = { viewModel.selectAll() },
                onDelete = { showDeleteConfirm = true },
                onRestore = { viewModel.restoreSelected() },
                onPermanentDelete = { showPermanentDeleteConfirm = true },
            )
        } else {
            // iOS-style large title with the filter bubble on the right
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    if (selectedFilter == MessageFilter.MESSAGES) "Messages" else selectedFilter.label,
                    color = White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 32.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                FilterBubble(
                    selected = selectedFilter,
                    onSelect = { viewModel.setFilter(it) },
                )
            }

            Spacer(Modifier.height(12.dp))

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                SearchPill(
                    value = searchQuery,
                    onValueChange = { viewModel.updateSearchQuery(it) },
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(10.dp))
                GlassIconButton(
                    icon = Icons.Filled.Edit,
                    contentDescription = "New message",
                    onClick = { navController.navigate(Screen.Compose.createRoute()) },
                )
            }
        }

        Spacer(Modifier.height(10.dp))

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
                if (isLoading) {
                    item {
                        Box(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            CircularProgressIndicator(color = TextSecondary, modifier = Modifier.size(28.dp))
                        }
                    }
                } else if (tabMessages.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            val emptyLabel = when (selectedFilter) {
                                MessageFilter.SPAM             -> "No Spam"
                                MessageFilter.BLOCKED          -> "No Blocked Messages"
                                MessageFilter.RECENTLY_DELETED -> "No Recently Deleted"
                                MessageFilter.UNREAD           -> "No Unread Messages"
                                MessageFilter.DRAFTS           -> "No Drafts"
                                else                           -> "No Messages"
                            }
                            Text(emptyLabel, color = TextTertiary, fontSize = 15.sp)
                        }
                    }
                } else {
                    val isDraftsFilter = selectedFilter == MessageFilter.DRAFTS
                    items(tabMessages) { msg ->
                        MessageListRow(
                            item = msg.toDisplayItem(isDraft = isDraftsFilter),
                            selectionMode = selectionMode,
                            isSelected = msg.id in selectedIds,
                            onClick = {
                                when {
                                    selectionMode -> viewModel.toggleSelected(msg.id)
                                    // Resume editing instead of opening a conversation —
                                    // a draft may not even have any real messages yet.
                                    isDraftsFilter -> navController.navigate(
                                        Screen.Compose.createRoute(recipient = msg.sender, body = msg.body)
                                    )
                                    else -> navController.navigate(Screen.Detail.createRoute(msg.sender))
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
                            modifier = Modifier.padding(start = 92.dp),
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

    if (showPermanentDeleteConfirm) {
        val count = selectedIds.size
        AlertDialog(
            onDismissRequest = { showPermanentDeleteConfirm = false },
            containerColor = SurfaceElevated,
            title = { Text("Permanently delete $count message${if (count == 1) "" else "s"}?", color = White) },
            text = { Text("This can't be undone.", color = TextSecondary) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.permanentlyDeleteSelected()
                    showPermanentDeleteConfirm = false
                }) { Text("Delete Permanently", color = Danger) }
            },
            dismissButton = {
                TextButton(onClick = { showPermanentDeleteConfirm = false }) { Text("Cancel", color = TextSecondary) }
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
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onCancel) {
            Icon(Icons.Filled.Close, contentDescription = "Cancel", tint = White)
        }
        Text(
            if (selectedCount == 0) "Select messages" else "$selectedCount selected",
            color = White,
            fontWeight = FontWeight.SemiBold,
            fontSize = 17.sp,
            modifier = Modifier.weight(1f).padding(start = 4.dp),
        )
        TextButton(onClick = onSelectAll) {
            Text("Select All", color = IosBlue, fontSize = 14.sp)
        }
        if (isRecentlyDeleted) {
            IconButton(onClick = onRestore, enabled = selectedCount > 0) {
                Icon(
                    Icons.Filled.Restore,
                    contentDescription = "Restore",
                    tint = if (selectedCount > 0) White else TextTertiary,
                )
            }
            IconButton(onClick = onPermanentDelete, enabled = selectedCount > 0) {
                Icon(
                    Icons.Filled.Delete,
                    contentDescription = "Delete permanently",
                    tint = if (selectedCount > 0) Danger else TextTertiary,
                )
            }
        } else {
            IconButton(onClick = onDelete, enabled = selectedCount > 0) {
                Icon(
                    Icons.Filled.Delete,
                    contentDescription = "Delete",
                    tint = if (selectedCount > 0) Danger else TextTertiary,
                )
            }
        }
    }
}

private fun SmsMessage.toDisplayItem(isDraft: Boolean = false) = MessageItem(
    sender = sender,
    initials = getInitialsFromSender(sender),
    avatarColor = getAvatarColor(sender),
    preview = if (isDraft) "Draft: $body" else body,
    timestamp = getRelativeTime(timestamp),
    badge = when (classification) {
        "suspicious" -> BadgeType.SUSPICIOUS
        "blocked"    -> BadgeType.BLOCKED
        "safe"       -> BadgeType.SAFE
        else         -> BadgeType.UNKNOWN
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
        modifier = modifier
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
                Text("Search", color = TextSecondary, fontSize = 16.sp)
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                textStyle = TextStyle(color = White, fontSize = 16.sp),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun GlassIconButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier
            .size(38.dp)
            .background(White.copy(alpha = 0.08f), CircleShape)
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick,
            ),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            icon,
            contentDescription = contentDescription,
            tint = White,
            modifier = Modifier.size(18.dp),
        )
    }
}

@Composable
private fun FilterBubble(
    selected: MessageFilter,
    onSelect: (MessageFilter) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }

    Box {
        GlassIconButton(
            icon = Icons.Filled.FilterList,
            contentDescription = "Filters",
            onClick = { expanded = true },
        )
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            containerColor = SurfaceElevated,
            shape = RoundedCornerShape(14.dp),
        ) {
            val mainFilters = listOf(
                MessageFilter.MESSAGES,
                MessageFilter.SPAM,
                MessageFilter.BLOCKED,
                MessageFilter.RECENTLY_DELETED,
            )
            mainFilters.forEach { filter ->
                FilterMenuItem(
                    label = filter.label,
                    checked = selected == filter,
                    onClick = {
                        expanded = false
                        onSelect(filter)
                    },
                )
            }
            HorizontalDivider(color = Hairline, thickness = 0.5.dp)
            FilterMenuItem(
                label = "Filter by Unread",
                checked = selected == MessageFilter.UNREAD,
                onClick = {
                    expanded = false
                    onSelect(
                        if (selected == MessageFilter.UNREAD) MessageFilter.MESSAGES
                        else MessageFilter.UNREAD,
                    )
                },
            )
            FilterMenuItem(
                label = "Drafts",
                checked = selected == MessageFilter.DRAFTS,
                onClick = {
                    expanded = false
                    onSelect(MessageFilter.DRAFTS)
                },
            )
        }
    }
}

@Composable
private fun FilterMenuItem(
    label: String,
    checked: Boolean,
    onClick: () -> Unit,
) {
    DropdownMenuItem(
        text = {
            Text(
                label,
                color = White,
                fontSize = 15.sp,
                fontWeight = if (checked) FontWeight.SemiBold else FontWeight.Normal,
            )
        },
        trailingIcon = {
            if (checked) {
                Icon(
                    Icons.Filled.Check,
                    contentDescription = null,
                    tint = IosBlue,
                    modifier = Modifier.size(18.dp),
                )
            }
        },
        onClick = onClick,
    )
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
        modifier = Modifier
            .fillMaxWidth()
            .combinedClickable(onClick = onClick, onLongClick = onLongClick)
            .padding(start = 8.dp, end = 12.dp, top = 10.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Unread indicator — iMessage-style blue dot in the gutter
        Box(modifier = Modifier.width(16.dp), contentAlignment = Alignment.Center) {
            if (!item.isRead) {
                Box(
                    modifier = Modifier
                        .size(9.dp)
                        .background(IosBlue, CircleShape),
                )
            }
        }
        if (selectionMode) {
            Icon(
                imageVector = if (isSelected) Icons.Filled.CheckCircle else Icons.Outlined.Circle,
                contentDescription = if (isSelected) "Selected" else "Not selected",
                tint = if (isSelected) Indigo else TextTertiary,
                modifier = Modifier.size(48.dp).padding(12.dp),
            )
        } else {
            SenderAvatar(sender = item.sender, size = 48.dp)
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    item.sender,
                    color = White,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    item.timestamp,
                    color = TextSecondary,
                    fontSize = 14.sp,
                )
                Icon(
                    Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint = TextTertiary,
                    modifier = Modifier.size(18.dp),
                )
            }
            Spacer(Modifier.height(1.dp))
            Text(
                item.preview,
                color = TextSecondary,
                fontSize = 14.sp,
                lineHeight = 19.sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(3.dp))
            VerdictLabel(item.badge)
        }
    }
}

@Composable
private fun VerdictLabel(badge: BadgeType) {
    val (label, color) = when (badge) {
        BadgeType.SAFE       -> "Safe" to Safe
        BadgeType.SUSPICIOUS -> "Suspicious" to Suspicious
        BadgeType.BLOCKED    -> "Blocked" to Danger
        else                 -> "Unknown" to TextTertiary
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(6.dp)
                .background(color, CircleShape),
        )
        Spacer(Modifier.width(5.dp))
        Text(label, color = color, fontSize = 12.sp, fontWeight = FontWeight.Medium)
    }
}
