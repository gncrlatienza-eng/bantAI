package com.bantai.ui.screens.main

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.navigation.Screen
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.BorderColor
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.White

private data class ShapFeature(
    val label: String,
    val sublabel: String,
    val progress: Float,
    val percentage: String,
)

private val shapFeatures = listOf(
    ShapFeature("Fake domain in link", "\"gcash-ph-support.net\" is not a registered GCash domain", 0.90f, "38%"),
    ShapFeature("Urgency keywords", "\"24 hours\", \"suspended\", \"immediately\" detected", 0.58f, "24%"),
    ShapFeature("Brand impersonation", "Message mimics GCash tone and branding", 0.44f, "18%"),
    ShapFeature("Credential request", "Asks user to log in via an external link", 0.29f, "12%"),
    ShapFeature("Unknown sender", "Number not in contact list or verified sender list", 0.19f, "8%"),
    ShapFeature("No personalization", "Generic \"Dear user\" — legitimate banks include your name", 0.07f, "3%"),
)

@Composable
fun SmishingAlertScreen(navController: NavController) {
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
            // Auto-blocked banner
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
                            "+63 908 000 1234 has been blocked. It can no longer send you messages.",
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
                            Text("GCash Alert", color = White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            Text("+63 908 000 1234", color = TextSecondary, fontSize = 12.sp)
                        }
                        Text("94% smishing", color = Danger, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                    HorizontalDivider(color = Color(0xFF2A2A2A))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { navController.navigate(Screen.CampaignDetail.createRoute(true)) },
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Icon(Icons.Default.Hub, contentDescription = null, tint = Suspicious, modifier = Modifier.size(14.dp))
                        Text(
                            "Part of: Operation GCash Clone #14",
                            color = Suspicious,
                            fontSize = 12.sp,
                            modifier = Modifier.weight(1f),
                        )
                        Text("View campaign →", color = Indigo, fontSize = 12.sp)
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
                        "BLOCKED MESSAGE CONTENT",
                        color = Color(0xFF666666),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        letterSpacing = 0.8.sp,
                    )
                    Box(
                        modifier = Modifier
                            .background(Color(0xFF2A2A2A), RoundedCornerShape(100.dp))
                            .padding(horizontal = 8.dp, vertical = 3.dp),
                    ) {
                        Text("Read-only", color = TextSecondary, fontSize = 10.sp)
                    }
                }
            }

            // Chat bubbles
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Surface, RoundedCornerShape(16.dp))
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    // Bubble 1
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF2A2A2A), RoundedCornerShape(16.dp))
                            .padding(12.dp),
                    ) {
                        Text(
                            "Dear GCash user, your account has been flagged for unusual activity.",
                            color = White,
                            fontSize = 14.sp,
                            lineHeight = 20.sp,
                        )
                        Spacer(Modifier.height(4.dp))
                        Text("9:01 AM", color = TextSecondary, fontSize = 11.sp, modifier = Modifier.align(Alignment.End))
                    }

                    // Bubble 2
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF2A2A2A), RoundedCornerShape(16.dp))
                            .padding(12.dp),
                    ) {
                        Text(
                            "Please verify your identity immediately at:",
                            color = White,
                            fontSize = 14.sp,
                            lineHeight = 20.sp,
                        )
                    }

                    // Bubble 3 — BLOCKED
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF2A0A0A), RoundedCornerShape(16.dp))
                            .border(1.dp, Danger, RoundedCornerShape(16.dp))
                            .padding(12.dp),
                    ) {
                        Box(
                            modifier = Modifier
                                .background(Color(0xFF3A0A0A), RoundedCornerShape(100.dp))
                                .padding(horizontal = 6.dp, vertical = 2.dp),
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(3.dp),
                            ) {
                                Icon(Icons.Default.Block, contentDescription = null, tint = Danger, modifier = Modifier.size(10.dp))
                                Text("BLOCKED", color = Danger, fontWeight = FontWeight.Bold, fontSize = 9.sp, letterSpacing = 0.5.sp)
                            }
                        }
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "gcash-ph-support.net/verify",
                            color = Danger,
                            fontSize = 14.sp,
                            textDecoration = TextDecoration.LineThrough,
                        )
                        Spacer(Modifier.height(4.dp))
                        Text("9:01 AM", color = TextSecondary, fontSize = 11.sp, modifier = Modifier.align(Alignment.End))
                    }

                    // Bubble 4
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF2A2A2A), RoundedCornerShape(16.dp))
                            .padding(12.dp),
                    ) {
                        Text(
                            "Failure to verify within 24 hours will result in permanent account suspension.",
                            color = White,
                            fontSize = 14.sp,
                            lineHeight = 20.sp,
                        )
                        Spacer(Modifier.height(4.dp))
                        Text("9:02 AM", color = TextSecondary, fontSize = 11.sp, modifier = Modifier.align(Alignment.End))
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
                        "These features contributed to the 94% smishing classification. Longer bars = stronger signal.",
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
                    shapFeatures.forEach { feature ->
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.Bottom,
                            ) {
                                Text(feature.label, color = White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                Text(feature.percentage, color = Danger, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                            }
                            Text(feature.sublabel, color = TextSecondary, fontSize = 11.sp, lineHeight = 15.sp)
                            LinearProgressIndicator(
                                progress = { feature.progress },
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
                    Text(
                        "XLM-RoBERTa classified this message as smishing with 94% confidence. The strongest signals were a fraudulent domain and urgency manipulation. HDBSCAN linked it to an active campaign targeting GCash users.",
                        color = White,
                        fontSize = 13.sp,
                        lineHeight = 20.sp,
                    )
                }
            }
        }
    }
}
