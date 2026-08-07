package com.bantai.ui.screens.main

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
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.data.remote.SmsApi
import com.bantai.navigation.Screen
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White
import com.bantai.viewmodel.AlertsViewModel
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

@Composable
fun AlertsScreen(
    navController: NavController,
    innerPadding: PaddingValues,
    viewModel: AlertsViewModel = viewModel(),
) {
    val alerts by viewModel.alerts.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()

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
                        .background(if (alerts.isEmpty()) Safe else Suspicious, CircleShape),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    if (alerts.isEmpty()) "All threats reviewed" else "${alerts.size} threat${if (alerts.size == 1) "" else "s"} flagged",
                    color = TextSecondary,
                    fontSize = 14.sp,
                )
            }
            Spacer(Modifier.height(4.dp))
        }

        when {
            isLoading -> item {
                Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = TextSecondary, modifier = Modifier.size(20.dp))
                }
            }
            errorMessage != null -> item {
                Text(errorMessage ?: "Could not load alerts", color = Danger, fontSize = 13.sp)
            }
            alerts.isEmpty() -> item {
                Text("No alerts yet — you'll see flagged messages here.", color = TextSecondary, fontSize = 13.sp)
            }
            else -> alerts.forEach { alert ->
                val blocked = alert.status.equals("Blocked", ignoreCase = true)
                item {
                    AlertCard(
                        alert = alert,
                        blocked = blocked,
                        onClick = {
                            navController.navigate(
                                if (blocked) Screen.SmishingAlert.createRoute(alert.messageId)
                                else Screen.ThreatAnalysis.createRoute(alert.messageId),
                            )
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun AlertCard(alert: SmsApi.AlertSummary, blocked: Boolean, onClick: () -> Unit) {
    val accent = if (blocked) Danger else Suspicious
    val icon: ImageVector = if (blocked) Icons.Default.Block else Icons.Default.Warning

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(SurfaceElevated, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
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
                    alert.sender,
                    color = White,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Spacer(Modifier.width(8.dp))
            Text(formatAlertTime(alert.receivedAt), color = TextSecondary, fontSize = 13.sp)
            Icon(
                Icons.Default.ChevronRight,
                contentDescription = null,
                tint = TextTertiary,
                modifier = Modifier.size(18.dp),
            )
        }

        Text(
            alert.body,
            color = TextSecondary,
            fontSize = 14.sp,
            lineHeight = 19.sp,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )

        StatusPill(
            label = if (blocked) "Auto-blocked" else "Suspicious",
            color = accent,
        )
    }
}

private fun formatAlertTime(iso: String): String = try {
    val zoned = Instant.parse(iso).atZone(ZoneId.systemDefault())
    if (zoned.toLocalDate() == ZonedDateTime.now().toLocalDate()) {
        zoned.format(DateTimeFormatter.ofPattern("h:mm a"))
    } else {
        zoned.format(DateTimeFormatter.ofPattern("MMM d"))
    }
} catch (_: Exception) {
    ""
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
