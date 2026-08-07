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
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Shield
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
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.BorderColor
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.White
import com.bantai.viewmodel.SmishingAlertViewModel
import kotlin.math.roundToInt

@Composable
fun SmishingAlertScreen(
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
    val isBlocked = status == "Blocked"

    val topTags = indicators.take(2).joinToString(" and ") { it.tag.lowercase() }
    val summaryText = buildString {
        append("XLM-RoBERTa classified this message as smishing with $scorePercent% confidence.")
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
                "Smishing Alert",
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp,
                modifier = Modifier.align(Alignment.Center),
            )
        }
        HorizontalDivider(color = Surface)

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 16.dp, top = 12.dp, end = 16.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (isBlocked) {
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF2A0A0A), RoundedCornerShape(12.dp))
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Icon(Icons.Default.Block, contentDescription = null, tint = Danger, modifier = Modifier.size(20.dp))
                        Column {
                            Text("Number auto-blocked", color = Danger, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Text(
                                "$sender has been blocked. It can no longer send you messages.",
                                color = TextSecondary,
                                fontSize = 12.sp,
                                lineHeight = 18.sp,
                            )
                        }
                    }
                }
            }

            // Sender info card
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Surface, RoundedCornerShape(16.dp))
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .background(Color(0xFF2A0A0A), RoundedCornerShape(8.dp)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(Icons.Default.Shield, contentDescription = null, tint = Danger, modifier = Modifier.size(18.dp))
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(sender, color = White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        }
                        Text("$scorePercent% smishing", color = Danger, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                }
            }

            // Message content header
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        if (isBlocked) "BLOCKED MESSAGE CONTENT" else "MESSAGE CONTENT",
                        color = Color(0xFF666666),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        letterSpacing = 0.8.sp,
                    )
                    if (isBlocked) {
                        Box(
                            modifier = Modifier
                                .background(Color(0xFF2A2A2A), RoundedCornerShape(100.dp))
                                .padding(horizontal = 8.dp, vertical = 3.dp),
                        ) {
                            Text("Read-only", color = TextSecondary, fontSize = 10.sp)
                        }
                    }
                }
            }

            // Message body bubble
            item {
                val bubbleBg = if (isBlocked) Color(0xFF2A0A0A) else Color(0xFF2A2A2A)
                val bubbleBorder = if (isBlocked) Danger else Color.Transparent
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Surface, RoundedCornerShape(16.dp))
                        .padding(12.dp),
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(bubbleBg, RoundedCornerShape(16.dp))
                            .then(
                                if (isBlocked) Modifier.border(1.dp, bubbleBorder, RoundedCornerShape(16.dp))
                                else Modifier,
                            )
                            .padding(12.dp),
                    ) {
                        Text(body, color = White, fontSize = 14.sp, lineHeight = 20.sp)
                    }
                }
            }

            // Why flagged section
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
                        "These features contributed to the $scorePercent% smishing classification. Longer bars = stronger signal.",
                        color = TextSecondary,
                        fontSize = 12.sp,
                        lineHeight = 18.sp,
                    )
                }
            }

            // SHAP feature bars
            item {
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
                                            color = Danger,
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
                                        color = Danger,
                                        trackColor = BorderColor,
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // XLM-RoBERTa summary card
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Surface, RoundedCornerShape(16.dp))
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Icon(Icons.Default.Psychology, contentDescription = null, tint = Indigo, modifier = Modifier.size(16.dp))
                    Text(summaryText, color = White, fontSize = 13.sp, lineHeight = 20.sp)
                }
            }
        }
    }
}
