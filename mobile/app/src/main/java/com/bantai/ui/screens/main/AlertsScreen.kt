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
import androidx.compose.material.icons.filled.HourglassEmpty
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
import java.time.format.DateTimeFormatter
import kotlin.math.roundToInt

@Composable
fun AlertsScreen(
    navController: NavController,
    innerPadding: PaddingValues,
    viewModel: AlertsViewModel = viewModel(),
) {
    val alerts by viewModel.alerts.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()

    val pendingCount = alerts.count { it.status == "Pending" }
    val statusText = if (pendingCount == 0) "All threats reviewed" else "$pendingCount unreviewed"
    val statusDot = if (pendingCount == 0) Safe else Suspicious

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
                        .background(statusDot, CircleShape),
                )
                Spacer(Modifier.width(6.dp))
                Text(statusText, color = TextSecondary, fontSize = 14.sp)
            }
            Spacer(Modifier.height(4.dp))
        }

        when {
            isLoading -> item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 32.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(color = TextSecondary, modifier = Modifier.size(24.dp))
                }
            }

            errorMessage != null -> item {
                InfoRow(
                    message = errorMessage ?: "Could not load alerts",
                    icon = Icons.Default.Warning,
                    isError = true,
                )
            }

            alerts.isEmpty() -> item {
                InfoRow(
                    message = "No threats detected yet",
                    icon = Icons.Default.HourglassEmpty,
                )
            }

            else -> alerts.forEach { alert ->
                item {
                    AlertCard(
                        alert = alert,
                        onClick = {
                            val msg = alert.message
                            if (alert.status == "Blocked") {
                                navController.navigate(
                                    Screen.SmishingAlert.createRoute(
                                        messageId = msg.id,
                                        sender = msg.sender,
                                        score = msg.score ?: 0.0,
                                        status = alert.status,
                                        body = msg.body.take(400),
                                    ),
                                )
                            } else {
                                navController.navigate(
                                    Screen.ThreatAnalysis.createRoute(
                                        messageId = msg.id,
                                        sender = msg.sender,
                                        score = msg.score ?: 0.0,
                                        status = alert.status,
                                        body = msg.body.take(400),
                                    ),
                                )
                            }
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun InfoRow(
    message: String,
    icon: ImageVector,
    isError: Boolean = false,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(SurfaceElevated, RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = if (isError) Danger else TextTertiary,
            modifier = Modifier.size(18.dp),
        )
        Text(
            message,
            color = if (isError) Danger else TextSecondary,
            fontSize = 13.sp,
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AlertCard(alert: SmsApi.AlertItem, onClick: () -> Unit) {
    val blocked = alert.status == "Blocked"
    val accent = if (blocked) Danger else Suspicious
    val icon: ImageVector = if (blocked) Icons.Default.Block else Icons.Default.Warning
    val scorePercent = alert.message.score?.let { "${(it * 100).roundToInt()}%" } ?: ""

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
                    alert.message.sender,
                    color = White,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (scorePercent.isNotEmpty()) {
                    Text("$scorePercent confidence", color = TextSecondary, fontSize = 13.sp)
                }
            }
            Spacer(Modifier.width(8.dp))
            Text(
                formatAlertTime(alert.message.receivedAt),
                color = TextSecondary,
                fontSize = 13.sp,
            )
            Icon(
                Icons.Default.ChevronRight,
                contentDescription = null,
                tint = TextTertiary,
                modifier = Modifier.size(18.dp),
            )
        }

        Text(
            alert.message.body,
            color = TextSecondary,
            fontSize = 14.sp,
            lineHeight = 19.sp,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )

        Row(verticalAlignment = Alignment.CenterVertically) {
            StatusPill(
                label = if (blocked) "Auto-blocked" else "Suspicious",
                color = accent,
            )
        }

        if (alert.message.label != null) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Box(
                    modifier = Modifier
                        .background(White.copy(alpha = 0.06f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                ) {
                    Text(alert.message.label, color = TextSecondary, fontSize = 12.sp)
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

private fun formatAlertTime(iso: String): String = try {
    val instant = Instant.parse(iso)
    val now = Instant.now()
    val seconds = now.epochSecond - instant.epochSecond
    when {
        seconds < 3600 -> "${seconds / 60}m"
        seconds < 86400 -> DateTimeFormatter.ofPattern("h:mm a")
            .format(instant.atZone(ZoneId.systemDefault()))
        seconds < 172800 -> "Yesterday"
        else -> DateTimeFormatter.ofPattern("MMM d")
            .format(instant.atZone(ZoneId.systemDefault()))
    }
} catch (_: Exception) {
    ""
}
