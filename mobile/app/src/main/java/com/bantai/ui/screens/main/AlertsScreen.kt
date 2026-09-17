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
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.data.remote.SmsApi
import com.bantai.navigation.Screen
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Hairline
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
import java.util.Locale

@Composable
fun AlertsScreen(
    navController: NavController,
    innerPadding: PaddingValues,
    viewModel: AlertsViewModel = viewModel(),
) {
    val alerts by viewModel.alerts.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()

    // Polling itself now lives in AlertsViewModel (viewModelScope), so the tab
    // badge stays live even while this screen isn't the one on screen — this
    // composable just observes whatever the ViewModel already has.

    val (todayAlerts, earlierAlerts) = alerts.partition { isToday(it.receivedAt) }

    fun onAlertClick(alert: SmsApi.AlertSummary) {
        val blocked = alert.status.equals("Blocked", ignoreCase = true)
        navController.navigate(
            if (blocked) Screen.SmishingAlert.createRoute(alert.messageId) else Screen.ThreatAnalysis.createRoute(alert.messageId),
        )
    }

    LazyColumn(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black)
                .statusBarsPadding(),
        contentPadding =
            PaddingValues(
                start = 20.dp,
                top = 16.dp,
                end = 20.dp,
                bottom = innerPadding.calculateBottomPadding() + 24.dp,
            ),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        item {
            Column {
                Text("Alerts", color = White, fontWeight = FontWeight.Bold, fontSize = 32.sp)
                Spacer(Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier =
                            Modifier
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
            }
        }

        when {
            isLoading ->
                item {
                    Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = TextSecondary, modifier = Modifier.size(20.dp))
                    }
                }
            errorMessage != null ->
                item {
                    Text(errorMessage ?: "Could not load alerts", color = Danger, fontSize = 13.sp)
                }
            alerts.isEmpty() ->
                item {
                    Box(Modifier.fillParentMaxSize(), contentAlignment = Alignment.Center) {
                        Text(
                            "No alerts yet — you'll see flagged messages here.",
                            color = TextSecondary,
                            fontSize = 13.sp,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            else -> {
                if (todayAlerts.isNotEmpty()) {
                    item {
                        AlertSection(title = "TODAY", sectionAlerts = todayAlerts, onAlertClick = ::onAlertClick)
                    }
                }
                if (earlierAlerts.isNotEmpty()) {
                    item {
                        AlertSection(title = "EARLIER", sectionAlerts = earlierAlerts, onAlertClick = ::onAlertClick)
                    }
                }
                item {
                    Text(
                        "Protection is on. Messages are scanned on this device.",
                        color = TextTertiary,
                        fontSize = 12.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                    )
                }
            }
        }
    }
}

// Grouped-list style: one glass card per section (Today / Earlier) holding all
// its rows, divided by hairlines, rather than a separate floating card per
// alert -- reads as one coherent list instead of a stack of loose tiles.
@Composable
private fun AlertSection(
    title: String,
    sectionAlerts: List<SmsApi.AlertSummary>,
    onAlertClick: (SmsApi.AlertSummary) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            title,
            color = TextTertiary,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            letterSpacing = 0.6.sp,
        )
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(SurfaceElevated, RoundedCornerShape(18.dp)),
        ) {
            sectionAlerts.forEachIndexed { index, alert ->
                val blocked = alert.status.equals("Blocked", ignoreCase = true)
                AlertRow(alert = alert, blocked = blocked, onClick = { onAlertClick(alert) })
                if (index != sectionAlerts.lastIndex) {
                    HorizontalDivider(color = Hairline, modifier = Modifier.padding(start = 20.dp))
                }
            }
        }
    }
}

@Composable
private fun AlertRow(
    alert: SmsApi.AlertSummary,
    blocked: Boolean,
    onClick: () -> Unit,
) {
    val accent = if (blocked) Danger else Suspicious

    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.size(8.dp).background(accent, CircleShape))
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    alert.sender,
                    color = White,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(8.dp))
                Text(formatAlertTime(alert.receivedAt), color = TextTertiary, fontSize = 12.sp)
            }
            Spacer(Modifier.height(2.dp))
            Text(
                alert.body,
                color = TextSecondary,
                fontSize = 13.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Spacer(Modifier.width(6.dp))
        Icon(
            Icons.Default.ChevronRight,
            contentDescription = null,
            tint = TextTertiary,
            modifier = Modifier.size(16.dp),
        )
    }
}

private fun isToday(iso: String): Boolean =
    try {
        Instant.parse(iso).atZone(ZoneId.systemDefault()).toLocalDate() == ZonedDateTime.now().toLocalDate()
    } catch (_: Exception) {
        false
    }

private fun formatAlertTime(iso: String): String =
    try {
        val zoned = Instant.parse(iso).atZone(ZoneId.systemDefault())
        if (zoned.toLocalDate() == ZonedDateTime.now().toLocalDate()) {
            // Locale.US pinned, not device default — the app has no localized string
            // resources yet, so a localized date/time next to hardcoded English labels
            // would look more inconsistent, not less.
            zoned.format(DateTimeFormatter.ofPattern("h:mm a", Locale.US))
        } else {
            zoned.format(DateTimeFormatter.ofPattern("MMM d", Locale.US))
        }
    } catch (_: Exception) {
        ""
    }
