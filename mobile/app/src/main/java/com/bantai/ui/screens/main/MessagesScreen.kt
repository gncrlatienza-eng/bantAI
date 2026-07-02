package com.bantai.ui.screens.main

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
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
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.TabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.data.model.SmsMessage
import com.bantai.navigation.Screen
import com.bantai.ui.components.BadgeType
import com.bantai.ui.components.MessageItem
import com.bantai.ui.components.StatusBadge
import com.bantai.ui.components.getAvatarColor
import com.bantai.ui.components.getInitialsFromSender
import com.bantai.ui.components.getRelativeTime
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.DarkIndigo
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.White
import com.bantai.viewmodel.MessagesViewModel

@OptIn(ExperimentalPermissionsApi::class)
@Composable
fun MessagesScreen(
    navController: NavController,
    innerPadding: PaddingValues,
    viewModel: MessagesViewModel = viewModel(),
) {
    val readSmsPermission = rememberPermissionState(android.Manifest.permission.READ_SMS)

    LaunchedEffect(Unit) {
        if (!readSmsPermission.status.isGranted) {
            readSmsPermission.launchPermissionRequest()
        }
    }

    LaunchedEffect(readSmsPermission.status.isGranted) {
        if (readSmsPermission.status.isGranted) {
            viewModel.onPermissionGranted()
        }
    }

    var selectedTab by remember { mutableStateOf(0) }
    val searchQuery by viewModel.searchQuery.collectAsState()
    val inboxMessages by viewModel.inboxMessages.collectAsState()
    val suspiciousMessages by viewModel.suspiciousMessages.collectAsState()
    val unknownMessages by viewModel.unknownMessages.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val suspiciousTodayCount by viewModel.suspiciousTodayCount.collectAsState()
    val unknownTodayCount by viewModel.unknownTodayCount.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Black)
            .padding(innerPadding),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Messages", color = White, fontWeight = FontWeight.Bold, fontSize = 24.sp)
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .background(Surface, RoundedCornerShape(10.dp))
                    .clickable { navController.navigate(Screen.Compose.route) },
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Default.Edit, contentDescription = "Edit", tint = White, modifier = Modifier.size(20.dp))
            }
        }

        OutlinedTextField(
            value = searchQuery,
            onValueChange = { viewModel.updateSearchQuery(it) },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp),
            placeholder = { Text("Search messages...", color = TextSecondary, fontSize = 14.sp) },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextSecondary) },
            shape = RoundedCornerShape(24.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Indigo,
                unfocusedBorderColor = Color.Transparent,
                focusedContainerColor = Surface,
                unfocusedContainerColor = Surface,
                cursorColor = Indigo,
            ),
            singleLine = true,
        )

        Spacer(Modifier.height(12.dp))

        TabRow(
            selectedTabIndex = selectedTab,
            modifier = Modifier.fillMaxWidth(),
            containerColor = Black,
            contentColor = White,
            indicator = { tabPositions ->
                val pos = tabPositions[selectedTab]
                Box(
                    Modifier
                        .fillMaxWidth()
                        .wrapContentSize(Alignment.BottomStart)
                        .offset(x = pos.left)
                        .width(pos.width)
                        .height(2.dp)
                        .background(Indigo),
                )
            },
            divider = { HorizontalDivider(color = Surface) },
        ) {
            MessagesTab(selected = selectedTab == 0, onClick = { selectedTab = 0 }, label = "Inbox",      count = inboxMessages.size,   countColor = Indigo)
            MessagesTab(selected = selectedTab == 1, onClick = { selectedTab = 1 }, label = "Suspicious", count = suspiciousTodayCount, countColor = Suspicious)
            MessagesTab(selected = selectedTab == 2, onClick = { selectedTab = 2 }, label = "Unknown",    count = unknownTodayCount,    countColor = Color(0xFF666666))
        }

        AnimatedContent(
            targetState = selectedTab,
            transitionSpec = {
                fadeIn(tween(250)) togetherWith fadeOut(tween(200))
            },
            label = "tab_switch",
        ) { tab ->
            val tabMessages = when (tab) {
                1    -> suspiciousMessages
                2    -> unknownMessages
                else -> inboxMessages
            }
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                if (isLoading) {
                    item {
                        Box(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            CircularProgressIndicator(color = Indigo, modifier = Modifier.size(32.dp))
                        }
                    }
                } else if (tabMessages.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("No messages", color = TextSecondary, fontSize = 14.sp)
                        }
                    }
                } else {
                    items(tabMessages) { msg ->
                        MessageListRow(
                            item = msg.toDisplayItem(),
                            onClick = { navController.navigate(Screen.Detail.createRoute(msg.sender)) },
                        )
                        HorizontalDivider(color = Surface, thickness = 0.5.dp)
                    }
                }
            }
        }
    }
}

private fun SmsMessage.toDisplayItem() = MessageItem(
    sender = sender,
    initials = getInitialsFromSender(sender),
    avatarColor = getAvatarColor(sender),
    preview = body,
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
private fun MessagesTab(
    selected: Boolean,
    onClick: () -> Unit,
    label: String,
    count: Int,
    countColor: Color,
) {
    Tab(
        selected = selected,
        onClick = onClick,
        modifier = Modifier.height(48.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
            modifier = Modifier.padding(horizontal = 4.dp),
        ) {
            Text(
                text = label,
                color = if (selected) White else TextSecondary,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                fontSize = 13.sp,
            )
            Spacer(Modifier.width(6.dp))
            if (count > 0) {
                Box(
                    modifier = Modifier
                        .background(countColor.copy(alpha = 0.2f), RoundedCornerShape(10.dp))
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = if (count > 99) "99+" else count.toString(),
                        color = countColor,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
    }
}

@Composable
private fun MessageListRow(item: MessageItem, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .background(if (!item.isRead) DarkIndigo else Black)
            .padding(horizontal = 20.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .background(item.avatarColor, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(item.initials, color = White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
            if (!item.isRead) {
                Box(
                    modifier = Modifier
                        .size(6.dp)
                        .background(Indigo, CircleShape)
                        .align(Alignment.TopStart),
                )
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    item.sender,
                    color = White,
                    fontWeight = if (!item.isRead) FontWeight.Bold else FontWeight.Normal,
                    fontSize = if (!item.isRead) 15.sp else 14.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    item.timestamp,
                    color = if (!item.isRead) Indigo else TextSecondary,
                    fontSize = 12.sp,
                    fontWeight = if (!item.isRead) FontWeight.Medium else FontWeight.Normal,
                )
            }
            Spacer(Modifier.height(2.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom,
            ) {
                Text(
                    item.preview,
                    color = if (!item.isRead) White else TextSecondary,
                    fontWeight = if (!item.isRead) FontWeight.Medium else FontWeight.Normal,
                    fontSize = 13.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(8.dp))
                StatusBadge(item.badge)
            }
        }
    }
}
