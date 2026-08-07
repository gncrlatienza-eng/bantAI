package com.bantai.ui.screens.main

import androidx.compose.foundation.background
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
import com.bantai.navigation.Screen
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.BorderColor
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.White
import com.bantai.viewmodel.SmishingAlertViewModel
import kotlin.math.roundToInt

@Composable
fun ThreatAnalysisScreen(
    navController: NavController,
    messageId: String,
    sender: String,
    score: Double,
    status: String,
    body: String,
) {
    val viewModel: SmishingAlertViewModel = viewModel()
    LaunchedEffect(messageId) { viewModel.loadIndicators(messageId) }

    val indicators by viewModel.indicators.collectAsState()
    val isAnalyzing by viewModel.isLoading.collectAsState()

    val scorePercent = (score * 100).roundToInt()

    val topTags = indicators.take(2).joinToString(" and ") { it.tag.lowercase() }
    val summaryText = buildString {
        append("XLM-RoBERTa classified this message as suspicious with $scorePercent% confidence.")
        if (topTags.isNotEmpty()) append(" The strongest signals were $topTags.")
    }

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
                                .background(Color(0xFF2A1A00), RoundedCornerShape(12.dp)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(Icons.Default.GppBad, contentDescription = null, tint = Suspicious, modifier = Modifier.size(24.dp))
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(sender, color = White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        }
                        Box(
                            modifier = Modifier
                                .background(Color(0xFF2A1A00), RoundedCornerShape(100.dp))
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                        ) {
                            Text("Suspicious", color = Suspicious, fontSize = 11.sp, fontWeight = FontWeight.Medium)
                        }
                    }
                    HorizontalDivider(color = Color(0xFF2A2A2A))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Text("Confidence", color = TextSecondary, fontSize = 12.sp)
                        LinearProgressIndicator(
                            progress = { score.toFloat() },
                            modifier = Modifier
                                .weight(1f)
                                .height(4.dp)
                                .clip(RoundedCornerShape(2.dp)),
                            color = Suspicious,
                            trackColor = BorderColor,
                        )
                        Text("$scorePercent%", color = Suspicious, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
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
                    Text(summaryText, color = White, fontSize = 14.sp, lineHeight = 22.sp)
                }
            }

            item {
                SectionLabel("THREAT INDICATORS")
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Surface, RoundedCornerShape(16.dp))
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    when {
                        isAnalyzing -> {
                            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator(color = TextSecondary, modifier = Modifier.size(20.dp))
                            }
                        }
                        indicators.isEmpty() -> {
                            Text("No indicators available yet.", color = TextSecondary, fontSize = 13.sp)
                        }
                        else -> {
                            indicators.forEach { indicator ->
                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.Bottom,
                                    ) {
                                        Text(indicator.tag, color = White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                        Text(
                                            "${(indicator.weight * 100).roundToInt()}%",
                                            color = Suspicious,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Medium,
                                        )
                                    }
                                    LinearProgressIndicator(
                                        progress = { indicator.weight.toFloat() },
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(4.dp)
                                            .clip(RoundedCornerShape(2.dp)),
                                        color = Suspicious,
                                        trackColor = BorderColor,
                                    )
                                }
                            }
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
