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
import androidx.compose.material.icons.automirrored.filled.ArrowBackIos
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.data.remote.SmsApi
import com.bantai.navigation.Screen
import com.bantai.ui.components.DetailSkeleton
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.BorderColor
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White
import com.bantai.viewmodel.AlertDetailViewModel
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt

@Composable
fun SmishingAlertScreen(
    messageId: String,
    navController: NavController,
    viewModel: AlertDetailViewModel = viewModel(),
) {
    val alert by viewModel.alert.collectAsState()
    val indicators by viewModel.indicators.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()

    LaunchedEffect(messageId) { viewModel.load(messageId) }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black),
    ) {
        // iOS-style back affordance: chevron + the screen you're returning to,
        // not a generic "Back" label or a repeated page title -- the hero
        // block right below already establishes what this screen is.
        Row(
            modifier =
                Modifier
                    .statusBarsPadding()
                    .padding(top = 6.dp)
                    .clickable { navController.popBackStack() }
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                Icons.AutoMirrored.Filled.ArrowBackIos,
                contentDescription = "Back",
                tint = Indigo,
                modifier = Modifier.size(16.dp),
            )
            Spacer(Modifier.width(2.dp))
            Text("Alerts", color = Indigo, fontSize = 15.sp)
        }

        when {
            isLoading -> DetailSkeleton()
            errorMessage != null ->
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(errorMessage ?: "Could not load this alert", color = Danger, fontSize = 14.sp)
                }
            alert == null ->
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("No alert details available", color = TextSecondary, fontSize = 14.sp)
                }
            else -> SmishingAlertContent(alert!!, indicators, navController)
        }
    }
}

@Composable
@Suppress("LongMethod", "MagicNumber", "MaxLineLength")
private fun SmishingAlertContent(
    alert: SmsApi.AlertSummary,
    indicators: List<SmsApi.IndicatorTag>,
    navController: NavController,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        // Bottom clearance matches the floating tab bar's footprint (see
        // MainScreen) -- this screen now renders behind that persistent bar.
        contentPadding = PaddingValues(start = 16.dp, top = 4.dp, end = 16.dp, bottom = 116.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        // High-risk banner. Blocking remains an explicit user choice.
        item {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF2A0A0A), RoundedCornerShape(12.dp))
                        .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Icon(Icons.Default.Block, contentDescription = null, tint = Danger, modifier = Modifier.size(20.dp))
                Column {
                    Text("High-risk message", color = Danger, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Text(
                        "Review the message, then choose whether to block, report, or ignore it.",
                        color = TextSecondary,
                        fontSize = 12.sp,
                        lineHeight = 18.sp,
                    )
                }
            }
        }

        // Sender info card
        item {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Box(
                        modifier =
                            Modifier
                                .size(36.dp)
                                .background(Color(0xFF2A0A0A), RoundedCornerShape(8.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Default.Block, contentDescription = null, tint = Danger, modifier = Modifier.size(18.dp))
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Sender retained on this device", color = White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Text(formatFullTimestamp(alert.receivedAt), color = TextSecondary, fontSize = 12.sp)
                    }
                    alert.score?.let { score ->
                        Text("${(score * 100).roundToInt()}% smishing", color = Danger, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                }
                // Real campaign association (backend-sourced clusterId) — dropped back
                // in August when this screen still showed mock content with no real
                // link target; the data has been available in GET /sms/alerts all
                // along, just never parsed on the mobile side until now.
                alert.clusterId?.let { clusterId ->
                    HorizontalDivider(color = BorderColor)
                    Row(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .clickable { navController.navigate(Screen.CampaignDetail.createRoute(clusterId)) },
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Icon(
                            Icons.Default.Hub,
                            contentDescription = null,
                            tint = Suspicious,
                            modifier = Modifier.size(14.dp),
                        )
                        Text(
                            "Part of a tracked campaign",
                            color = Suspicious,
                            fontSize = 12.sp,
                            modifier = Modifier.weight(1f),
                        )
                        Text("View campaign →", color = Indigo, fontSize = 12.sp)
                    }
                }
            }
        }

        // Blocked message content header
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    "FLAGGED MESSAGE CONTENT",
                    color = Color(0xFF666666),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    letterSpacing = 0.8.sp,
                )
                Row(
                    modifier =
                        Modifier
                            .background(Danger.copy(alpha = 0.15f), RoundedCornerShape(100.dp))
                            .padding(horizontal = 10.dp, vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Box(modifier = Modifier.size(6.dp).background(Danger, CircleShape))
                    Text("Flagged", color = Danger, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
                Spacer(Modifier.height(10.dp))
                Text(
                    alert.label?.replaceFirstChar { it.uppercase() } ?: "Smishing",
                    color = White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 30.sp,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    buildString {
                        alert.score?.let { append("${(it * 100).roundToInt()}% confidence · ") }
                        append(alert.sender)
                    },
                    color = TextSecondary,
                    fontSize = 13.sp,
                )
            }
        }

        // Real campaign association (backend-sourced clusterId) -- only
        // renders when the backend actually clustered this message into a
        // tracked campaign, not just whenever this screen is shown.
        alert.clusterId?.let { clusterId ->
            item {
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(Suspicious.copy(alpha = 0.12f), RoundedCornerShape(14.dp))
                            .clickable { navController.navigate(Screen.CampaignDetail.createRoute(clusterId)) }
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Icon(Icons.Default.Hub, contentDescription = null, tint = Suspicious, modifier = Modifier.size(14.dp))
                    Text(
                        "Part of a tracked campaign",
                        color = Suspicious,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.weight(1f),
                    )
                    Text("View →", color = Suspicious, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        // Message content
        item {
            SectionLabel("MESSAGE")
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .background(SurfaceElevated, RoundedCornerShape(18.dp))
                        .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(alert.body, color = White, fontSize = 14.sp, lineHeight = 20.sp)
                Text(formatFullTimestamp(alert.receivedAt), color = TextTertiary, fontSize = 11.sp)
            }
        }

        // Why flagged -- one grouped card of plain rows (reason, then how strong
        // a signal it was) instead of a progress bar per indicator; reads faster
        // and matches the rest of this screen's flatter, simpler card language.
        item {
            SectionLabel("WHY IT WAS FLAGGED")
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .background(SurfaceElevated, RoundedCornerShape(18.dp)),
            ) {
                if (indicators.isEmpty()) {
                    Text(
                        "Still computing explainability for this message.",
                        color = TextSecondary,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(16.dp),
                    )
                }
            }
        }

        // Why flagged section label
        item {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    "WHY BANTAI FLAGGED THIS",
                    color = Color(0xFF666666),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    letterSpacing = 0.8.sp,
                )
                Text(
                    "Detailed server-side indicators are unavailable because message text stays on your device.",
                    color = TextSecondary,
                    fontSize = 12.sp,
                    lineHeight = 18.sp,
                )
            }
        }

        // SHAP feature bars
        item {
            if (indicators.isEmpty()) {
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(Surface, RoundedCornerShape(16.dp))
                            .padding(16.dp),
                ) {
                    Text("Still computing explainability for this message.", color = TextSecondary, fontSize = 13.sp)
                }
            } else {
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(Surface, RoundedCornerShape(16.dp))
                            .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    indicators.forEachIndexed { index, indicator ->
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.Bottom,
                            ) {
                                Text(indicator.tag, color = White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                Text(
                                    "${(indicator.weight.coerceIn(0.0, 1.0) * 100).roundToInt()}%",
                                    color = Danger,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                )
                            }
                            LinearProgressIndicator(
                                progress = { indicator.weight.coerceIn(0.0, 1.0).toFloat() },
                                modifier =
                                    Modifier
                                        .fillMaxWidth()
                                        .height(4.dp)
                                        .clip(RoundedCornerShape(2.dp)),
                                color = Danger,
                                trackColor = BorderColor,
                            )
                            Text(severityLabel(indicator.weight), color = TextSecondary, fontSize = 13.sp)
                        }
                        if (index != indicators.lastIndex) {
                            HorizontalDivider(color = Hairline, modifier = Modifier.padding(start = 16.dp))
                        }
                    }
                }
            }
        }

        // Actions -- only what's actually wired end to end. There's no
        // standalone "mark as safe" or per-alert delete yet, and report/block
        // share one confirm flow, so this is a single honest row into it
        // rather than several buttons that all land on the same screen.
        item {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .background(SurfaceElevated, RoundedCornerShape(18.dp))
                        .clickable {
                            navController.navigate(Screen.TakeAction.createRoute(alert.messageId, alert.sender))
                        }.padding(horizontal = 16.dp, vertical = 15.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Default.Psychology, contentDescription = null, tint = Indigo, modifier = Modifier.size(16.dp))
                Text(
                    buildString {
                        append("Classified as ")
                        append(alert.label ?: "smishing")
                        alert.score?.let { append(" with ${(it * 100).roundToInt()}% confidence") }
                        append(". Choose Block, Report, or Ignore after reviewing the result.")
                    },
                    color = White,
                    fontSize = 13.sp,
                    lineHeight = 20.sp,
                )
            }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text,
        color = TextTertiary,
        fontSize = 12.sp,
        fontWeight = FontWeight.Medium,
        letterSpacing = 0.6.sp,
        modifier = Modifier.padding(bottom = 8.dp),
    )
}

private fun severityLabel(weight: Double): String =
    when (weight.coerceIn(0.0, 1.0)) {
        in 0.66..1.0 -> "High"
        in 0.33..0.66 -> "Medium"
        else -> "Low"
    }

private fun formatFullTimestamp(iso: String): String =
    try {
        Instant
            .parse(iso)
            .atZone(ZoneId.systemDefault())
            .format(DateTimeFormatter.ofPattern("MMM d 'at' h:mm a", Locale.US))
    } catch (_: Exception) {
        ""
    }
