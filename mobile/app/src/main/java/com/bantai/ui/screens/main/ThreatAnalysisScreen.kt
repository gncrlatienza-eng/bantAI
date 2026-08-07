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
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.data.remote.SmsApi
import com.bantai.navigation.Screen
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.BorderColor
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.White
import com.bantai.viewmodel.AlertDetailViewModel
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlin.math.roundToInt

@Composable
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
        modifier = Modifier
            .fillMaxSize()
            .background(Black),
    ) {
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
                "Threat Analysis",
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp,
                modifier = Modifier.align(Alignment.Center),
            )
        }
        HorizontalDivider(color = Surface)

        when {
            isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = TextSecondary)
            }
            errorMessage != null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(errorMessage ?: "Could not load this alert", color = Danger, fontSize = 14.sp)
            }
            alert == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No threat details available", color = TextSecondary, fontSize = 14.sp)
            }
            else -> ThreatAnalysisContent(alert!!, indicators, navController)
        }
    }
}

@Composable
private fun ThreatAnalysisContent(
    alert: SmsApi.AlertSummary,
    indicators: List<SmsApi.IndicatorTag>,
    navController: NavController,
) {
    val confidence = (alert.score ?: 0.0).coerceIn(0.0, 1.0)

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 20.dp, top = 8.dp, end = 20.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item {
            Column(
                modifier = Modifier
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
                        modifier = Modifier
                            .size(48.dp)
                            .background(Color(0xFF2A0A0A), RoundedCornerShape(12.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Default.GppBad, contentDescription = null, tint = Danger, modifier = Modifier.size(24.dp))
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(alert.sender, color = White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text(formatFullTimestamp(alert.receivedAt), color = TextSecondary, fontSize = 12.sp)
                    }
                    Box(
                        modifier = Modifier
                            .background(Color(0xFF2A1A00), RoundedCornerShape(100.dp))
                            .border(1.dp, Suspicious, RoundedCornerShape(100.dp))
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                    ) {
                        Text(alert.label ?: "Suspicious", color = Suspicious, fontSize = 11.sp, fontWeight = FontWeight.Medium)
                    }
                }
                HorizontalDivider(color = Color(0xFF2A2A2A))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text("Confidence", color = TextSecondary, fontSize = 12.sp)
                    LinearProgressIndicator(
                        progress = { confidence.toFloat() },
                        modifier = Modifier
                            .weight(1f)
                            .height(4.dp)
                            .clip(RoundedCornerShape(2.dp)),
                        color = Suspicious,
                        trackColor = BorderColor,
                    )
                    Text("${(confidence * 100).roundToInt()}%", color = Suspicious, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }
            }
        }

        item {
            SectionLabel("MESSAGE")
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Surface, RoundedCornerShape(16.dp))
                    .padding(16.dp),
            ) {
                Text(alert.body, color = White, fontSize = 14.sp, lineHeight = 20.sp)
            }
        }

        item {
            SectionLabel("AI SUMMARY")
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Surface, RoundedCornerShape(16.dp))
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Icon(Icons.Default.Psychology, contentDescription = null, tint = Indigo, modifier = Modifier.size(20.dp))
                Text(
                    buildString {
                        append("This message was classified as ")
                        append(alert.label ?: "suspicious")
                        append(" with ${(confidence * 100).roundToInt()}% confidence.")
                    },
                    color = White,
                    fontSize = 14.sp,
                    lineHeight = 22.sp,
                )
            }
        }

        item {
            SectionLabel("THREAT INDICATORS")
            if (indicators.isEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Surface, RoundedCornerShape(16.dp))
                        .padding(16.dp),
                ) {
                    Text("Still computing explainability for this message.", color = TextSecondary, fontSize = 13.sp)
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
            SectionLabel("ACTIONS")
            Button(
                onClick = { navController.navigate(Screen.TakeAction.route) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Indigo),
            ) {
                Text("Take action", color = White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
            Spacer(Modifier.height(8.dp))
        }
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
        modifier = Modifier.padding(top = 8.dp, bottom = 8.dp),
    )
}

@Composable
private fun ThreatIndicatorCard(title: String, subtitle: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Surface, RoundedCornerShape(16.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .background(Color(0xFF2A0A0A), RoundedCornerShape(8.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Default.Warning, contentDescription = null, tint = Danger, modifier = Modifier.size(20.dp))
        }
        Column {
            Text(title, color = White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Text(subtitle, color = TextSecondary, fontSize = 12.sp, lineHeight = 16.sp)
        }
    }
}

private fun formatFullTimestamp(iso: String): String = try {
    Instant.parse(iso).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("MMM d, h:mm a"))
} catch (_: Exception) {
    ""
}
