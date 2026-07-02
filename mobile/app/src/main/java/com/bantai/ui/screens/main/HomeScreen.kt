package com.bantai.ui.screens.main

import android.os.Build
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.GppBad
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
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
import androidx.compose.ui.graphics.graphicsLayer
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.DarkIndigo
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.ProtectionSurface
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.White
import com.bantai.viewmodel.HomeViewModel

private fun Int.formatCount(): String = when {
    this >= 1000 -> "${this / 1000}k+"
    this >= 100  -> "99+"
    else         -> toString()
}

@OptIn(ExperimentalPermissionsApi::class)
@Composable
fun HomeScreen(
    navController: NavController,
    innerPadding: PaddingValues,
    onNavigateToMessages: () -> Unit = {},
    viewModel: HomeViewModel = viewModel(),
) {
    val readSmsPermission = rememberPermissionState(android.Manifest.permission.READ_SMS)
    val notificationPermission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        rememberPermissionState(android.Manifest.permission.POST_NOTIFICATIONS)
    } else null

    LaunchedEffect(Unit) {
        if (!readSmsPermission.status.isGranted) {
            readSmsPermission.launchPermissionRequest()
        }
        notificationPermission?.let {
            if (!it.status.isGranted) {
                it.launchPermissionRequest()
            }
        }
    }

    LaunchedEffect(readSmsPermission.status.isGranted) {
        if (readSmsPermission.status.isGranted) {
            viewModel.onPermissionGranted()
        }
    }

    val userData by viewModel.userData.collectAsState()
    val recentMessages by viewModel.recentMessages.collectAsState()
    val scannedCount by viewModel.scannedCount.collectAsState()
    val smishingCount by viewModel.smishingCount.collectAsState()
    val suspiciousCount by viewModel.suspiciousCount.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val scanPeriod by viewModel.scanPeriod.collectAsState()
    val contentAlpha by animateFloatAsState(
        targetValue = if (!isLoading) 1f else 0f,
        animationSpec = tween(durationMillis = 400),
        label = "content_fade",
    )

    val avatarColor = remember(userData.avatarColor) {
        try { Color(android.graphics.Color.parseColor(userData.avatarColor)) }
        catch (e: Exception) { Color(0xFFFF6B35) }
    }

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
            Column {
                Text(viewModel.getGreeting(), color = TextSecondary, fontSize = 13.sp)
                Text(userData.firstName.ifEmpty { "..." }, color = White, fontWeight = FontWeight.Bold, fontSize = 22.sp)
            }
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .background(avatarColor, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(viewModel.getInitials(), color = White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        }

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer { alpha = contentAlpha },
            contentPadding = PaddingValues(start = 20.dp, top = 0.dp, end = 20.dp, bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(ProtectionSurface, RoundedCornerShape(16.dp))
                        .border(1.dp, Safe.copy(alpha = 0.3f), RoundedCornerShape(16.dp))
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Icon(Icons.Filled.VerifiedUser, contentDescription = null, tint = Safe, modifier = Modifier.size(24.dp))
                        Column {
                            Text("Status", color = TextSecondary, fontSize = 11.sp)
                            Text("Protected", color = Safe, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        }
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("Monitoring active", color = TextSecondary, fontSize = 11.sp)
                        Spacer(Modifier.height(6.dp))
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .background(Safe, CircleShape)
                                .align(Alignment.End),
                        )
                    }
                }
            }

            item {
                val periodLabel = when (scanPeriod) {
                    "weekly" -> "This week"
                    "monthly" -> "This month"
                    else -> "Today"
                }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "Threat overview",
                        color = White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                    )
                    Text(
                        text = periodLabel,
                        color = Color(0xFF5B4FE8),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }

            item {
                val periodLabel = when (scanPeriod) {
                    "weekly" -> "This week"
                    "monthly" -> "This month"
                    else -> "Today"
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    StatCard(
                        modifier = Modifier.weight(1f).clickable { onNavigateToMessages() },
                        icon = Icons.Outlined.Shield,
                        iconTint = TextSecondary,
                        value = scannedCount.formatCount(),
                        valueColor = White,
                        label = "Scanned",
                    )
                    StatCard(
                        modifier = Modifier.weight(1f).clickable { onNavigateToMessages() },
                        icon = Icons.Filled.GppBad,
                        iconTint = Danger,
                        value = smishingCount.formatCount(),
                        valueColor = Danger,
                        label = "Smishing",
                        subtitle = periodLabel.lowercase(),
                    )
                    StatCard(
                        modifier = Modifier.weight(1f).clickable { onNavigateToMessages() },
                        icon = Icons.Filled.Warning,
                        iconTint = Suspicious,
                        value = suspiciousCount.formatCount(),
                        valueColor = Suspicious,
                        label = "Suspicious",
                        subtitle = periodLabel.lowercase(),
                    )
                }
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Recent messages", color = White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Text("See all", color = Indigo, fontSize = 13.sp, modifier = Modifier.clickable { onNavigateToMessages() })
                }
            }

            if (isLoading) {
                item {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(color = Indigo, modifier = Modifier.size(32.dp))
                    }
                }
            } else if (recentMessages.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("No messages yet", color = TextSecondary, fontSize = 14.sp)
                    }
                }
            } else {
                items(recentMessages) { msg ->
                    HomeMessageRow(
                        item = msg.toDisplayItem(),
                        onClick = { navController.navigate(Screen.Detail.createRoute(msg.sender)) },
                    )
                    HorizontalDivider(color = Color(0xFF1A1A1A), thickness = 0.5.dp)
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
        "safe" -> BadgeType.SAFE
        else -> BadgeType.UNKNOWN
    },
    isRead = isRead,
)

@Composable
private fun StatCard(
    modifier: Modifier = Modifier,
    icon: ImageVector,
    iconTint: Color,
    value: String,
    valueColor: Color,
    label: String,
    subtitle: String? = null,
) {
    Column(
        modifier = modifier
            .background(Surface, RoundedCornerShape(16.dp))
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(20.dp))
        Text(value, color = valueColor, fontWeight = FontWeight.Bold, fontSize = 22.sp)
        Text(label, color = TextSecondary, fontSize = 12.sp)
        if (subtitle != null) {
            Text(subtitle, color = TextSecondary, fontSize = 10.sp)
        }
    }
}

@Composable
private fun HomeMessageRow(item: MessageItem, onClick: () -> Unit) {
    val rowBackground = if (!item.isRead) DarkIndigo else Color.Transparent
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(rowBackground)
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.size(48.dp)) {
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
                        .size(10.dp)
                        .background(Indigo, CircleShape)
                        .align(Alignment.TopStart),
                )
            }
        }
        Column(modifier = Modifier.weight(1f).padding(horizontal = 12.dp)) {
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
                Text(item.timestamp, color = TextSecondary, fontSize = 12.sp)
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
                    fontSize = 13.sp,
                    fontWeight = if (!item.isRead) FontWeight.Medium else FontWeight.Normal,
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
