package com.bantai.ui.screens.settings

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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.bantai.viewmodel.SettingsViewModel
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.BorderColor
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.White

@Composable
fun NotificationsScreen(navController: NavController, viewModel: SettingsViewModel) {
    var selectedTab by remember { mutableStateOf(0) }
    val smishingAlerts by viewModel.smishingAlerts.collectAsState()
    val suspiciousAlerts by viewModel.suspiciousAlerts.collectAsState()
    val autoBlockNotice by viewModel.autoBlockNotice.collectAsState()

    Column(modifier = Modifier.fillMaxSize().background(Black)) {
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
            Text(
                "Notifications",
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp,
                modifier = Modifier.align(Alignment.Center),
            )
        }
        HorizontalDivider(color = Surface)

        Row(
            modifier = Modifier.fillMaxWidth().background(Black),
        ) {
            TabItem(
                label = "Threat alerts",
                icon = { Icon(Icons.Filled.Notifications, contentDescription = null, modifier = Modifier.size(16.dp)) },
                selected = selectedTab == 0,
                onClick = { selectedTab = 0 },
                modifier = Modifier.weight(1f),
            )
            TabItem(
                label = "Weekly digest",
                icon = { Icon(Icons.Filled.BarChart, contentDescription = null, modifier = Modifier.size(16.dp)) },
                selected = selectedTab == 1,
                onClick = { selectedTab = 1 },
                modifier = Modifier.weight(1f),
            )
        }
        HorizontalDivider(color = BorderColor)

        when (selectedTab) {
            0 -> ThreatAlertsTab(
                smishingAlerts = smishingAlerts,
                onSmishingAlertsChanged = { viewModel.toggleSmishingAlerts(it) },
                suspiciousAlerts = suspiciousAlerts,
                onSuspiciousAlertsChanged = { viewModel.toggleSuspiciousAlerts(it) },
                autoBlockNotice = autoBlockNotice,
                onAutoBlockNoticeChanged = { viewModel.toggleAutoBlockNotice(it) },
            )
            1 -> WeeklyDigestTab()
        }
    }
}

@Composable
private fun TabItem(
    label: String,
    icon: @Composable () -> Unit,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val color = if (selected) Indigo else Color(0xFF666666)
    Box(
        modifier = modifier
            .clickable(onClick = onClick)
            .drawBehind {
                if (selected) {
                    drawLine(
                        color = Indigo,
                        start = Offset(0f, size.height),
                        end = Offset(size.width, size.height),
                        strokeWidth = 2.dp.toPx(),
                    )
                }
            }
            .padding(vertical = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            CompositionLocalProvider(LocalContentColor provides color) {
                icon()
            }
            Text(
                label,
                color = color,
                fontSize = 13.sp,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
            )
        }
    }
}

@Composable
private fun ThreatAlertsTab(
    smishingAlerts: Boolean,
    onSmishingAlertsChanged: (Boolean) -> Unit,
    suspiciousAlerts: Boolean,
    onSuspiciousAlertsChanged: (Boolean) -> Unit,
    autoBlockNotice: Boolean,
    onAutoBlockNoticeChanged: (Boolean) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Text(
                "This is how BantAI notifies you when a smishing or suspicious message is detected. Tap a notification to expand it.",
                color = TextSecondary,
                fontSize = 13.sp,
            )
        }

        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Surface, RoundedCornerShape(16.dp))
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(0.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("9:02 AM", color = TextSecondary, fontSize = 12.sp)
                }
                Spacer(Modifier.height(8.dp))

                NotificationItem(
                    title = "⚠ Smishing detected — GCash Alert",
                    subtitle = "Likely smishing message received from GCash Alert. Dangerous link detected. Sender auto-blocked.",
                    time = "now",
                    expanded = true,
                    dangerLink = "gcash-ph-support.net/verify — do not tap",
                )
                HorizontalDivider(color = BorderColor, modifier = Modifier.padding(vertical = 8.dp))

                NotificationItem(
                    title = "⚡ Suspicious message — BDO Online",
                    subtitle = "A suspicious message from BDO Online contains an unverified link. Review it in BantAI.",
                    time = "18m",
                    expanded = false,
                )
                HorizontalDivider(color = BorderColor, modifier = Modifier.padding(vertical = 8.dp))

                NotificationItem(
                    title = "BantAI is protecting you",
                    subtitle = "1,284 messages scanned today. All clear except 2 threats already handled.",
                    time = "6h",
                    expanded = false,
                )
            }
        }

        item {
            SectionLabel("NOTIFICATION SETTINGS")
        }

        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Surface, RoundedCornerShape(16.dp)),
            ) {
                ToggleRow(
                    title = "Smishing alerts",
                    subtitle = "Immediate notification",
                    checked = smishingAlerts,
                    onCheckedChange = onSmishingAlertsChanged,
                )
                HorizontalDivider(color = BorderColor, thickness = 1.dp)
                ToggleRow(
                    title = "Suspicious alerts",
                    subtitle = "Immediate notification",
                    checked = suspiciousAlerts,
                    onCheckedChange = onSuspiciousAlertsChanged,
                )
                HorizontalDivider(color = BorderColor, thickness = 1.dp)
                ToggleRow(
                    title = "Auto-block notice",
                    subtitle = "When a number is blocked",
                    checked = autoBlockNotice,
                    onCheckedChange = onAutoBlockNoticeChanged,
                )
            }
        }
    }
}

@Composable
private fun NotificationItem(
    title: String,
    subtitle: String,
    time: String,
    expanded: Boolean,
    dangerLink: String? = null,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier = Modifier
                .size(32.dp)
                .background(Indigo, RoundedCornerShape(8.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.Shield, contentDescription = null, tint = White, modifier = Modifier.size(18.dp))
        }
        Spacer(Modifier.width(8.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("BantAI", color = TextSecondary, fontSize = 12.sp)
                Text(time, color = TextSecondary, fontSize = 12.sp)
            }
            Text(title, color = White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            Text(subtitle, color = TextSecondary, fontSize = 12.sp)
            if (dangerLink != null) {
                Spacer(Modifier.height(4.dp))
                Text(dangerLink, color = Danger, fontSize = 11.sp)
            }
            if (expanded && dangerLink != null) {
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(
                        modifier = Modifier
                            .background(Color(0xFF2A0A0A), RoundedCornerShape(100.dp))
                            .border(1.dp, Danger, RoundedCornerShape(100.dp))
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                    ) {
                        Text("View details", color = Danger, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                    }
                    Box(
                        modifier = Modifier
                            .background(Color(0xFF2A2A2A), RoundedCornerShape(100.dp))
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                    ) {
                        Text("Dismiss", color = White, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                    }
                }
            }
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
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Text(subtitle, color = TextSecondary, fontSize = 12.sp)
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = White,
                checkedTrackColor = Color(0xFF5B4FE8),
            ),
        )
    }
}

@Composable
private fun WeeklyDigestTab() {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Text(
                "BantAI sends you a weekly summary of your protection stats. Here's a preview of what it looks like.",
                color = TextSecondary,
                fontSize = 13.sp,
            )
        }

        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF1A1A2A), RoundedCornerShape(16.dp))
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Shield, contentDescription = null, tint = Indigo, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Column {
                        Text("Your weekly report", color = White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text("May 5 – May 11, 2025", color = TextSecondary, fontSize = 11.sp)
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                ) {
                    StatColumn("284", "Scanned", "this week", White)
                    StatColumn("6", "Smishing", "detected", Danger)
                    StatColumn("11", "Suspicious", "flagged", Suspicious)
                    StatColumn("6", "Blocked", "auto-blocked", Color(0xFF34C759))
                }

                Text("Threat breakdown", color = TextSecondary, fontSize = 12.sp)

                // Segmented bar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp)
                        .clip(RoundedCornerShape(4.dp)),
                ) {
                    Box(modifier = Modifier.fillMaxWidth(0.021f).height(8.dp).background(Danger))
                    Box(modifier = Modifier.fillMaxWidth(0.040f).height(8.dp).background(Suspicious))
                    Box(modifier = Modifier.weight(1f).height(8.dp).background(Color(0xFF34C759)))
                }

                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    LegendDot(Danger, "Smishing 2.1%")
                    LegendDot(Suspicious, "Suspicious 3.9%")
                    LegendDot(Color(0xFF34C759), "Safe 94%")
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF16163A), RoundedCornerShape(12.dp))
                        .padding(12.dp),
                    verticalAlignment = Alignment.Top,
                ) {
                    Icon(Icons.Filled.Bolt, contentDescription = null, tint = Indigo, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "6 smishing messages were detected this week — 2 more than last week. Stay cautious of GCash-related texts.",
                        color = White,
                        fontSize = 13.sp,
                    )
                }
            }
        }

        item { SectionLabel("HOW IT LOOKS ON YOUR PHONE") }

        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Surface, RoundedCornerShape(12.dp))
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(24.dp)
                            .background(Indigo, RoundedCornerShape(6.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Filled.Shield, contentDescription = null, tint = White, modifier = Modifier.size(14.dp))
                    }
                    Spacer(Modifier.width(8.dp))
                    Text("BantAI", color = TextSecondary, fontSize = 12.sp, modifier = Modifier.weight(1f))
                    Text("Sun 9:00 AM", color = TextSecondary, fontSize = 12.sp)
                }
                Text("BantAI Weekly Report — May 5–11", color = White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Text(
                    "284 messages scanned · 6 smishing · 11 suspicious · 6 auto-blocked. Tap to view your full report.",
                    color = TextSecondary,
                    fontSize = 12.sp,
                )
            }
        }

        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF16163A), RoundedCornerShape(12.dp))
                    .border(1.dp, Indigo, RoundedCornerShape(12.dp))
                    .padding(14.dp),
                contentAlignment = Alignment.Center,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Icon(Icons.Filled.BarChart, contentDescription = null, tint = Indigo, modifier = Modifier.size(18.dp))
                    Text("Send sample weekly report", color = Indigo, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }
            }
        }

        item {
            Text(
                "Pull down your notification shade to see it on your phone.",
                color = TextSecondary,
                fontSize = 11.sp,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun StatColumn(value: String, label: String, sub: String, valueColor: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, color = valueColor, fontWeight = FontWeight.Bold, fontSize = 20.sp)
        Text(label, color = TextSecondary, fontSize = 11.sp)
        Text(sub, color = TextSecondary, fontSize = 10.sp)
    }
}

@Composable
private fun LegendDot(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(modifier = Modifier.size(8.dp).background(color, RoundedCornerShape(4.dp)))
        Text(label, color = TextSecondary, fontSize = 10.sp)
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text,
        color = Color(0xFF666666),
        fontSize = 11.sp,
        fontWeight = FontWeight.Medium,
        letterSpacing = 1.sp,
        modifier = Modifier.padding(top = 4.dp, bottom = 4.dp),
    )
}
