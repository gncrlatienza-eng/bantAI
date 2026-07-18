package com.bantai.ui.screens.main

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.navigation.Screen
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White

private data class ThreatAlert(
    val title: String,
    val number: String,
    val time: String,
    val preview: String,
    val reasons: List<String>,
    val campaign: String?,
    val blocked: Boolean,
)

private val alerts = listOf(
    ThreatAlert(
        title = "GCash Alert",
        number = "+63 908 000 1234",
        time = "9:01 AM",
        preview = "Your account has been flagged. Verify now at gcash-ph-support.net/verify...",
        reasons = listOf("Fake domain in link", "Urgency keywords", "Brand impersonation"),
        campaign = "Operation GCash Clone #14",
        blocked = true,
    ),
    ThreatAlert(
        title = "+63 908 111 2222",
        number = "Unknown sender",
        time = "Yesterday",
        preview = "Congratulations! You've been selected for a ₱5,000 GCash reward. Claim at...",
        reasons = listOf("Credential request via link", "Reward bait language", "Unknown sender"),
        campaign = "Operation GCash Clone #14",
        blocked = true,
    ),
    ThreatAlert(
        title = "BDO Online",
        number = "+63 2 8631 8000",
        time = "18m",
        preview = "You have a pending transaction of ₱12,500. Tap to review and confirm.",
        reasons = listOf("Unverified sender domain", "Urgency language", "Shortened URL"),
        campaign = null,
        blocked = false,
    ),
)

@Composable
fun AlertsScreen(navController: NavController, innerPadding: PaddingValues) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Black)
            .statusBarsPadding(),
        contentPadding = PaddingValues(
            start = 20.dp,
            top = 16.dp,
            end = 20.dp,
            bottom = innerPadding.calculateBottomPadding() + 24.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Text("Alerts", color = White, fontWeight = FontWeight.Bold, fontSize = 32.sp)
            Spacer(Modifier.height(4.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(7.dp)
                        .background(Safe, CircleShape),
                )
                Spacer(Modifier.width(6.dp))
                Text("All threats reviewed", color = TextSecondary, fontSize = 14.sp)
            }
            Spacer(Modifier.height(4.dp))
        }

        alerts.forEach { alert ->
            item {
                AlertCard(
                    alert = alert,
                    onClick = {
                        navController.navigate(
                            if (alert.blocked) Screen.SmishingAlert.route
                            else Screen.ThreatAnalysis.route,
                        )
                    },
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AlertCard(alert: ThreatAlert, onClick: () -> Unit) {
    val accent = if (alert.blocked) Danger else Suspicious
    val icon: ImageVector = if (alert.blocked) Icons.Default.Block else Icons.Default.Warning

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(SurfaceElevated, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(38.dp)
                    .background(accent.copy(alpha = 0.15f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(18.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    alert.title,
                    color = White,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(alert.number, color = TextSecondary, fontSize = 13.sp)
            }
            Spacer(Modifier.width(8.dp))
            Text(alert.time, color = TextSecondary, fontSize = 13.sp)
            Icon(
                Icons.Default.ChevronRight,
                contentDescription = null,
                tint = TextTertiary,
                modifier = Modifier.size(18.dp),
            )
        }

        Text(
            alert.preview,
            color = TextSecondary,
            fontSize = 14.sp,
            lineHeight = 19.sp,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )

        Row(verticalAlignment = Alignment.CenterVertically) {
            StatusPill(
                label = if (alert.blocked) "Auto-blocked" else "Suspicious",
                color = accent,
            )
            if (alert.campaign != null) {
                Spacer(Modifier.width(8.dp))
                Icon(
                    Icons.Default.Hub,
                    contentDescription = null,
                    tint = TextTertiary,
                    modifier = Modifier.size(13.dp),
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    alert.campaign,
                    color = TextTertiary,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }

        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            alert.reasons.forEach { reason ->
                Box(
                    modifier = Modifier
                        .background(White.copy(alpha = 0.06f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                ) {
                    Text(reason, color = TextSecondary, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
private fun StatusPill(label: String, color: Color) {
    Box(
        modifier = Modifier
            .background(color.copy(alpha = 0.15f), RoundedCornerShape(100.dp))
            .padding(horizontal = 9.dp, vertical = 3.dp),
    ) {
        Text(label, color = color, fontSize = 12.sp, fontWeight = FontWeight.Medium)
    }
}
