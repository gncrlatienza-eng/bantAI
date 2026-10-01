package com.bantai.ui.screens.main

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.GppBad
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.data.remote.SmsApi
import com.bantai.ui.components.DetailSkeleton
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.BorderColor
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.OnIndigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.SuspiciousText
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White
import com.bantai.viewmodel.AlertDetailViewModel
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt

@Composable
@Suppress("LongMethod")
fun ThreatAnalysisScreen(
    messageId: String = "",
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
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.action_back),
                    tint = White,
                )
            }
            Text(
                stringResource(R.string.threat_analysis_threat_analysis),
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = TextSize.Headline,
                modifier = Modifier.align(Alignment.Center),
            )
        }
        HorizontalDivider(color = Surface)

        when {
            isLoading -> DetailSkeleton()
            errorMessage != null ->
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        errorMessage ?: stringResource(R.string.alert_load_failed),
                        color = Danger,
                        fontSize = TextSize.Subhead,
                    )
                }
            alert == null ->
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        stringResource(R.string.threat_analysis_no_threat_details_available),
                        color = TextSecondary,
                        fontSize = TextSize.Subhead,
                    )
                }
            else -> ThreatAnalysisContent(alert!!, indicators)
        }
    }
}

@Composable
@Suppress("LongMethod", "MaxLineLength")
private fun ThreatAnalysisContent(
    alert: SmsApi.AlertSummary,
    indicators: List<SmsApi.IndicatorTag>,
) {
    val confidence = (alert.score ?: 0.0).coerceIn(0.0, 1.0)

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 20.dp, top = 8.dp, end = 20.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .background(Surface, RoundedCornerShape(16.dp))
                        .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Box(
                        modifier =
                            Modifier
                                .size(48.dp)
                                .background(Danger.copy(alpha = 0.15f), RoundedCornerShape(12.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Default.GppBad, contentDescription = null, tint = Danger, modifier = Modifier.size(24.dp))
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(stringResource(R.string.threat_analysis_message_stored_on_this_device), color = White, fontWeight = FontWeight.Bold, fontSize = TextSize.Body)
                        Text(formatFullTimestamp(alert.receivedAt), color = TextSecondary, fontSize = TextSize.Caption)
                    }
                    Box(
                        modifier =
                            Modifier
                                .background(Suspicious.copy(alpha = 0.15f), RoundedCornerShape(100.dp))
                                .border(1.dp, Suspicious, RoundedCornerShape(100.dp))
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                    ) {
                        Text(alert.label ?: "Suspicious", color = SuspiciousText, fontSize = TextSize.Caption2, fontWeight = FontWeight.Medium)
                    }
                }
                HorizontalDivider(color = BorderColor)
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text(stringResource(R.string.threat_analysis_confidence), color = TextSecondary, fontSize = TextSize.Caption)
                    LinearProgressIndicator(
                        progress = { confidence.toFloat() },
                        modifier =
                            Modifier
                                .weight(1f)
                                .height(4.dp)
                                .clip(RoundedCornerShape(2.dp)),
                        color = Suspicious,
                        trackColor = BorderColor,
                    )
                    Text("${(confidence * 100).roundToInt()}%", color = SuspiciousText, fontWeight = FontWeight.Bold, fontSize = TextSize.Subhead)
                }
            }
        }

        item {
            SectionLabel(stringResource(R.string.threat_analysis_message))
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .background(Surface, RoundedCornerShape(16.dp))
                        .padding(16.dp),
            ) {
                Text(alert.body, color = White, fontSize = TextSize.Subhead, lineHeight = 20.sp)
            }
        }

        item {
            SectionLabel(stringResource(R.string.threat_analysis_ai_summary))
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .background(Surface, RoundedCornerShape(16.dp))
                        .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Icon(Icons.Default.Psychology, contentDescription = null, tint = Indigo, modifier = Modifier.size(20.dp))
                Text(
                    stringResource(
                        R.string.threat_analysis_classified_as,
                        alert.label ?: stringResource(R.string.verdict_suspicious),
                        (confidence * 100).roundToInt(),
                    ),
                    color = White,
                    fontSize = TextSize.Subhead,
                    lineHeight = 22.sp,
                )
            }
        }

        item {
            SectionLabel(stringResource(R.string.threat_analysis_threat_indicators))
            if (indicators.isEmpty()) {
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(Surface, RoundedCornerShape(16.dp))
                            .padding(16.dp),
                ) {
                    // Stale claim removed: indicators are server-computed from
                    // the masked text the backend already receives, unrelated
                    // to raw-body-on-device privacy -- see SmishingAlertScreen's
                    // identical fix. This screen itself is currently unwired
                    // (no navigation reaches it), but its indicators source is
                    // the same AlertDetailViewModel, so it'll show real tags
                    // too whenever it's wired back in.
                    Text(stringResource(R.string.threat_analysis_no_specific_indicators_were_recorded), color = TextSecondary, fontSize = TextSize.Footnote)
                }
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    indicators.forEach { indicator ->
                        ThreatIndicatorCard(indicator.tag, "${(indicator.weight.coerceIn(0.0, 1.0) * 100).roundToInt()}% contribution")
                    }
                }
            }
        }

        item {
            SectionLabel(stringResource(R.string.threat_analysis_actions))
            Button(
                onClick = {},
                enabled = false,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 52.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Indigo),
            ) {
                Text(stringResource(R.string.threat_analysis_use_your_device_inbox_to), color = OnIndigo, fontWeight = FontWeight.Bold, fontSize = TextSize.Body)
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text,
        color = TextSecondary,
        fontSize = TextSize.Caption2,
        fontWeight = FontWeight.Medium,
        letterSpacing = 1.sp,
        modifier = Modifier.padding(top = 8.dp, bottom = 8.dp),
    )
}

@Composable
private fun ThreatIndicatorCard(
    title: String,
    subtitle: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(Surface, RoundedCornerShape(16.dp))
                .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(36.dp)
                    .background(Danger.copy(alpha = 0.15f), RoundedCornerShape(8.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Default.Warning, contentDescription = null, tint = Danger, modifier = Modifier.size(20.dp))
        }
        Column {
            Text(title, color = White, fontWeight = FontWeight.Bold, fontSize = TextSize.Subhead)
            Text(subtitle, color = TextSecondary, fontSize = TextSize.Caption, lineHeight = 16.sp)
        }
    }
}

private fun formatFullTimestamp(iso: String): String =
    try {
        Instant
            .parse(iso)
            .atZone(ZoneId.systemDefault())
            .format(DateTimeFormatter.ofPattern("MMM d, h:mm a", Locale.US))
    } catch (_: Exception) {
        ""
    }
