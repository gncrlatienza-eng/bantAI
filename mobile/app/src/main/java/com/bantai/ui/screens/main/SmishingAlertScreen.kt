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
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.data.local.AlertStateStore
import com.bantai.data.remote.SmsApi
import com.bantai.navigation.Screen
import com.bantai.ui.components.DetailSkeleton
import com.bantai.ui.components.SenderAvatar
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.IosBlue
import com.bantai.ui.theme.OnAccent
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White
import com.bantai.util.SmsRiskSignals
import com.bantai.viewmodel.AlertDetailViewModel
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

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
    val resolvedSender by viewModel.resolvedSender.collectAsState()
    val isTrustedSender by viewModel.isTrustedSender.collectAsState()

    val context = LocalContext.current
    LaunchedEffect(messageId) {
        viewModel.load(messageId)
        // Opening an alert from anywhere (Alerts, a notification, Campaigns)
        // clears its "new" dot and the tab count.
        AlertStateStore(context).markSeen(messageId)
    }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black),
    ) {
        // iOS-style back affordance: chevron + the screen you're returning to.
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
                tint = IosBlue,
                modifier = Modifier.size(16.dp),
            )
            Spacer(Modifier.width(2.dp))
            Text("Alerts", color = IosBlue, fontSize = TextSize.Body)
        }

        when {
            isLoading -> DetailSkeleton()
            errorMessage != null -> CenteredNote(errorMessage ?: "Could not load this alert", color = Danger)
            alert == null -> CenteredNote("This alert is no longer available", color = TextSecondary)
            else -> SmishingAlertContent(alert!!, resolvedSender, isTrustedSender, indicators, navController)
        }
    }
}

/**
 * One fact per line, top to bottom: who sent it and the verdict, the message
 * itself, why it was flagged, then what can be done.
 * - A scam's sender is blocked automatically; the alert is a record, with a
 *   "Not a scam?" report for a wrong verdict.
 * - A trusted sender name (bank, e-wallet, telco, app -- see TrustedSenders)
 *   is never blocked: names are spoofable (e.g. by SMS blasters), so blocking
 *   "BDO" would block the real bank too. It gets Report only, plus a warning
 *   when the content gives a spoof away (SmsRiskSignals.spoofWarning).
 */
@Composable
private fun SmishingAlertContent(
    alert: SmsApi.AlertSummary,
    resolvedSender: String,
    isTrustedSender: Boolean,
    indicators: List<SmsApi.IndicatorTag>,
    navController: NavController,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        // Bottom clearance matches the floating tab bar's footprint.
        contentPadding = PaddingValues(start = 20.dp, top = 8.dp, end = 20.dp, bottom = 116.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        item { AlertHeader(alert, resolvedSender) }

        item { MessageBubble(alert) }

        if (indicators.isNotEmpty()) {
            item { ReasonsCard(indicators) }
        }

        alert.clusterId?.let { clusterId ->
            item {
                CampaignRow(onClick = { navController.navigate(Screen.CampaignDetail.createRoute(clusterId)) })
            }
        }

        val isScam = alert.bucket == "blocked" || alert.label == "Likely Smishing"
        // resolvedSender (from the local SMS provider) instead of alert.sender,
        // which the backend always sends as "".
        val openReport = {
            navController.navigate(
                Screen.TakeAction.createRoute(
                    messageId = alert.messageId,
                    sender = resolvedSender,
                    currentLabel = if (isScam) "Scam" else "",
                    action = "report",
                    canBlock = false,
                ),
            )
        }
        if (isTrustedSender) {
            SmsRiskSignals.spoofWarning(resolvedSender, alert.body)?.let { warning ->
                item { SpoofWarningCard(warning) }
            }
            item { TrustedSenderNote(resolvedSender.ifEmpty { "this sender" }) }
            item { ReportButton(onClick = openReport) }
        } else {
            item { AutoBlockedNote(onReportMistake = openReport) }
        }
    }
}

@Composable
private fun AlertHeader(
    alert: SmsApi.AlertSummary,
    resolvedSender: String,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        SenderAvatar(sender = resolvedSender.ifEmpty { "?" }, size = 64.dp)
        Spacer(Modifier.height(12.dp))
        Text(
            resolvedSender.ifEmpty { "Unknown sender" },
            color = White,
            fontWeight = FontWeight.Bold,
            fontSize = TextSize.Title,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Spacer(Modifier.height(2.dp))
        Text(formatFullTimestamp(alert.receivedAt), color = TextSecondary, fontSize = TextSize.Footnote)
        Spacer(Modifier.height(12.dp))
        val isScam = alert.bucket == "blocked" || alert.label == "Likely Smishing"
        val tint = if (isScam) Danger else Suspicious
        Row(
            modifier =
                Modifier
                    .background(tint.copy(alpha = 0.15f), RoundedCornerShape(100.dp))
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(6.dp).background(tint, CircleShape))
            Spacer(Modifier.width(6.dp))
            // No percentage: the model's score is its confidence in itself (it
            // reads ~99.9% on nearly every scam verdict), not how often it's
            // right, so showing "100%" overstated certainty.
            Text(
                if (isScam) "Likely scam" else "Suspicious",
                color = tint,
                fontWeight = FontWeight.SemiBold,
                fontSize = TextSize.Footnote,
            )
        }
    }
}

@Composable
private fun MessageBubble(alert: SmsApi.AlertSummary) {
    Text(
        alert.body,
        color = White,
        fontSize = TextSize.Body,
        lineHeight = 21.sp,
        modifier =
            Modifier
                .fillMaxWidth()
                .background(SurfaceElevated, RoundedCornerShape(18.dp))
                .padding(horizontal = 16.dp, vertical = 14.dp),
    )
}

@Composable
private fun ReasonsCard(indicators: List<SmsApi.IndicatorTag>) {
    Column {
        Text(
            "Why it was flagged",
            color = TextSecondary,
            fontSize = TextSize.Footnote,
            modifier = Modifier.padding(start = 4.dp, bottom = 8.dp),
        )
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(SurfaceElevated, RoundedCornerShape(14.dp)),
        ) {
            // Strongest reason first; the raw weights read as noise to users.
            indicators.sortedByDescending { it.weight }.forEachIndexed { index, indicator ->
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 13.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.size(6.dp).background(Danger, CircleShape))
                    Spacer(Modifier.width(12.dp))
                    Text(indicator.tag, color = White, fontSize = TextSize.Body)
                }
                if (index != indicators.lastIndex) {
                    HorizontalDivider(color = Hairline, thickness = 0.5.dp, modifier = Modifier.padding(start = 34.dp))
                }
            }
        }
    }
}

@Composable
private fun SpoofWarningCard(warning: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(Suspicious.copy(alpha = 0.12f), RoundedCornerShape(14.dp))
                .padding(16.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Icon(
            Icons.Outlined.WarningAmber,
            contentDescription = null,
            tint = Suspicious,
            modifier = Modifier.size(18.dp),
        )
        Spacer(Modifier.width(10.dp))
        Text(warning, color = White, fontSize = TextSize.Subhead, lineHeight = 20.sp)
    }
}

@Composable
private fun ReportButton(onClick: () -> Unit) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(Indigo, RoundedCornerShape(14.dp))
                .clickable(onClick = onClick)
                .padding(vertical = 15.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text("Report this message", color = OnAccent, fontWeight = FontWeight.SemiBold, fontSize = TextSize.Body)
    }
}

@Composable
private fun TrustedSenderNote(senderName: String) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(SurfaceElevated, RoundedCornerShape(14.dp))
                .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                Icons.Outlined.VerifiedUser,
                contentDescription = null,
                tint = IosBlue,
                modifier = Modifier.size(18.dp),
            )
            Spacer(Modifier.width(10.dp))
            Text("Why there's no Block", color = White, fontWeight = FontWeight.SemiBold, fontSize = TextSize.Body)
        }
        Text(
            "Anyone can fake a sender name like \"$senderName\" -- scammers use fake cell towers to send texts " +
                "that never pass through your telco. Blocking the name would also block the real $senderName's " +
                "OTPs and alerts, so report the message instead, and don't open its links or share codes.",
            color = TextSecondary,
            fontSize = TextSize.Subhead,
            lineHeight = 20.sp,
        )
    }
}

@Composable
private fun AutoBlockedNote(onReportMistake: () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(SurfaceElevated, RoundedCornerShape(14.dp))
                .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Shield, contentDescription = null, tint = Safe, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(10.dp))
            Text("Blocked automatically", color = White, fontWeight = FontWeight.SemiBold, fontSize = TextSize.Body)
        }
        Text(
            "BantAI stopped this sender. If a message like this ever reaches your inbox, " +
                "don't open its links or reply.",
            color = TextSecondary,
            fontSize = TextSize.Subhead,
            lineHeight = 20.sp,
        )
        Text(
            "Not a scam? Report a mistake",
            color = Indigo,
            fontWeight = FontWeight.SemiBold,
            fontSize = TextSize.Subhead,
            modifier = Modifier.clickable(onClick = onReportMistake).padding(top = 4.dp),
        )
    }
}

@Composable
private fun CampaignRow(onClick: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(SurfaceElevated, RoundedCornerShape(14.dp))
                .clickable(onClick = onClick)
                .padding(horizontal = 16.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Default.Hub, contentDescription = null, tint = Suspicious, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(12.dp))
        Text("Part of a scam campaign", color = White, fontSize = TextSize.Body, modifier = Modifier.weight(1f))
        Icon(
            Icons.Default.ChevronRight,
            contentDescription = null,
            tint = TextTertiary,
            modifier = Modifier.size(18.dp),
        )
    }
}

@Composable
private fun CenteredNote(
    text: String,
    color: androidx.compose.ui.graphics.Color,
) {
    Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
        Text(text, color = color, fontSize = TextSize.Body, textAlign = TextAlign.Center)
    }
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
