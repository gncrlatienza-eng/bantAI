package com.bantai.ui.screens.settings

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.navigation.NavController
import com.bantai.data.remote.SmsApi
import com.bantai.ui.components.BantAILogo
import com.bantai.ui.components.MessageRowSkeleton
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.BorderColor
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.OnAccent
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White
import com.bantai.viewmodel.SettingsViewModel

/**
 * One page of notification toggles. Each switch maps to a real check in
 * SmsIngestPipeline.applyServerClassification/applyOfflineCaution:
 * smishing/suspicious off → a plain message notification instead of the
 * high-priority alert; spam off → no notification (still filed to Spam).
 * Sound/vibration per channel is left to the system settings row.
 */
@Composable
fun NotificationsScreen(
    navController: NavController,
    viewModel: SettingsViewModel,
) {
    val smishingAlerts by viewModel.smishingAlerts.collectAsState()
    val suspiciousAlerts by viewModel.suspiciousAlerts.collectAsState()
    val spamAlerts by viewModel.spamAlerts.collectAsState()
    val autoBlockNotice by viewModel.autoBlockNotice.collectAsState()
    val recentAlerts by viewModel.recentAlerts.collectAsState()
    val alertsLoading by viewModel.alertsLoading.collectAsState()
    val context = LocalContext.current

    Column(modifier = Modifier.fillMaxSize().background(Black)) {
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
            Text(
                "Notifications",
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = TextSize.Headline,
                modifier = Modifier.align(Alignment.Center),
            )
        }
        HorizontalDivider(color = Surface)

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            // Bottom clearance matches the floating tab bar's footprint (see
            // MainScreen) -- this screen renders behind that persistent bar.
            contentPadding = PaddingValues(start = 16.dp, top = 16.dp, end = 16.dp, bottom = 116.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item { NotificationPermissionBanner() }

            item { SectionLabel("ALERT TYPES") }

            item {
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(Surface, RoundedCornerShape(16.dp)),
                ) {
                    ToggleRow(
                        title = "Smishing alerts",
                        subtitle = "High-priority alert for likely scam messages",
                        checked = smishingAlerts,
                        onCheckedChange = { viewModel.toggleSmishingAlerts(it) },
                    )
                    HorizontalDivider(color = BorderColor, thickness = 1.dp)
                    ToggleRow(
                        title = "Suspicious alerts",
                        subtitle = "Alert for messages worth a second look",
                        checked = suspiciousAlerts,
                        onCheckedChange = { viewModel.toggleSuspiciousAlerts(it) },
                    )
                    HorizontalDivider(color = BorderColor, thickness = 1.dp)
                    ToggleRow(
                        title = "Spam alerts",
                        subtitle = "Notify when a promo is filed to your Spam folder",
                        checked = spamAlerts,
                        onCheckedChange = { viewModel.toggleSpamAlerts(it) },
                    )
                    HorizontalDivider(color = BorderColor, thickness = 1.dp)
                    ToggleRow(
                        title = "Auto-block notice",
                        subtitle = "When a number is blocked",
                        checked = autoBlockNotice,
                        onCheckedChange = { viewModel.toggleAutoBlockNotice(it) },
                    )
                }
            }

            item {
                Text(
                    "Turning off smishing or suspicious alerts still shows the message as a normal notification, " +
                        "so nothing is hidden from you.",
                    color = TextSecondary,
                    fontSize = TextSize.Caption,
                    lineHeight = 16.sp,
                    modifier = Modifier.padding(horizontal = 4.dp),
                )
            }

            item {
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(Surface, RoundedCornerShape(16.dp))
                            .clickable {
                                val intent =
                                    Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                                        putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                                    }
                                runCatching { context.startActivity(intent) }
                            }.padding(horizontal = 16.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Icons.Filled.Tune,
                        contentDescription = null,
                        tint = TextSecondary,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            "Sound & vibration",
                            color = White,
                            fontWeight = FontWeight.Medium,
                            fontSize = TextSize.Subhead,
                        )
                        Text(
                            "Managed in Android notification settings",
                            color = TextSecondary,
                            fontSize = TextSize.Caption,
                        )
                    }
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowForwardIos,
                        contentDescription = null,
                        tint = TextSecondary,
                        modifier = Modifier.size(14.dp),
                    )
                }
            }

            item { SectionLabel("RECENT ALERTS") }

            item {
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(Surface, RoundedCornerShape(16.dp))
                            .padding(12.dp),
                ) {
                    when {
                        alertsLoading ->
                            repeat(2) {
                                MessageRowSkeleton(avatarSize = 36.dp, horizontalPadding = 0.dp, verticalPadding = 6.dp)
                            }
                        recentAlerts.isEmpty() ->
                            NotificationItem(
                                title = "BantAI is protecting you",
                                subtitle = "No threats detected yet. All messages are clear.",
                                time = "",
                            )
                        else ->
                            recentAlerts.take(3).forEachIndexed { index, alert ->
                                if (index > 0) {
                                    HorizontalDivider(
                                        color = BorderColor,
                                        modifier = Modifier.padding(vertical = 10.dp),
                                    )
                                }
                                RecentAlertItem(alert)
                            }
                    }
                }
            }
        }
    }
}

// The toggles only choose which BantAI alerts are sent -- they can't make
// Android deliver anything without the OS-level POST_NOTIFICATIONS
// permission, so surface that gap instead of letting "on" look like it works
// (see NotificationHelper.canPostNotifications).
@Composable
private fun NotificationPermissionBanner() {
    val context = LocalContext.current
    val isGranted = {
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
    }
    var notificationsGranted by remember { mutableStateOf(isGranted()) }
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer =
            LifecycleEventObserver { _, event ->
                if (event == Lifecycle.Event.ON_RESUME) notificationsGranted = isGranted()
            }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    if (notificationsGranted) return
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(Danger.copy(alpha = 0.15f), RoundedCornerShape(12.dp))
                .clickable {
                    val intent =
                        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                            putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                        }
                    runCatching { context.startActivity(intent) }
                }.padding(12.dp),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(Icons.Filled.WarningAmber, contentDescription = null, tint = Suspicious, modifier = Modifier.size(18.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                "Notifications are off for BantAI",
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = TextSize.Footnote,
            )
            Text(
                "The alerts below won't reach you until you turn on notifications in system settings. Tap to fix this.",
                color = TextSecondary,
                fontSize = TextSize.Caption,
                lineHeight = 16.sp,
            )
        }
    }
}

@Composable
private fun RecentAlertItem(alert: SmsApi.AlertSummary) {
    // Alert status is always "Pending" (nothing ever changes it), so the old
    // status == "Blocked" check labelled every alert "Suspicious"; the model's
    // label is what actually separates a scam from a softer flag.
    val isScam = alert.label.equals("Scam", ignoreCase = true)
    val sender = alert.sender.ifBlank { "Unknown sender" }
    val confidence = alert.score?.let { " · ${"%.0f".format(it * 100)}% confidence" } ?: ""
    NotificationItem(
        title = if (isScam) "Smishing detected — $sender" else "Suspicious message — $sender",
        subtitle = (if (isScam) "Likely scam. Review in BantAI" else "Review in BantAI") + confidence,
        time = alertRelativeTime(alert.createdAt),
    )
}

/**
 * Mirrors what the real notification looks like, with the app icon itself
 * (BantAILogo) as the tile -- the same icon Android shows beside a BantAI
 * notification.
 */
@Composable
private fun NotificationItem(
    title: String,
    subtitle: String,
    time: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        BantAILogo(size = 36.dp)
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("BantAI", color = TextSecondary, fontSize = TextSize.Caption)
                if (time.isNotEmpty()) Text(time, color = TextSecondary, fontSize = TextSize.Caption)
            }
            Text(
                title,
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = TextSize.Footnote,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(subtitle, color = TextSecondary, fontSize = TextSize.Caption)
        }
    }
}

@Composable
private fun ToggleRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable { onCheckedChange(!checked) }
                .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = White, fontWeight = FontWeight.Bold, fontSize = TextSize.Subhead)
            Text(subtitle, color = TextSecondary, fontSize = TextSize.Caption)
        }
        Spacer(Modifier.width(12.dp))
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors =
                SwitchDefaults.colors(
                    checkedThumbColor = OnAccent,
                    checkedTrackColor = Indigo,
                ),
        )
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text,
        color = TextTertiary,
        fontSize = TextSize.Caption2,
        fontWeight = FontWeight.Medium,
        letterSpacing = 1.sp,
        modifier = Modifier.padding(top = 4.dp, start = 4.dp),
    )
}

private fun alertRelativeTime(iso: String): String =
    try {
        val instant = java.time.Instant.parse(iso)
        val diffMin =
            (
                java.time.Instant
                    .now()
                    .toEpochMilli() - instant.toEpochMilli()
            ) / 60_000
        when {
            diffMin < 1 -> "now"
            diffMin < 60 -> "${diffMin}m"
            diffMin < 1440 -> "${diffMin / 60}h"
            else ->
                java.time.format.DateTimeFormatter
                    .ofPattern("MMM d", java.util.Locale.US)
                    .format(instant.atZone(java.time.ZoneId.systemDefault()))
        }
    } catch (_: Exception) {
        ""
    }
