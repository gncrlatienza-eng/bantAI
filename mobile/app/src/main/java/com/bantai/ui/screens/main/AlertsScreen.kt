package com.bantai.ui.screens.main

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.navigation.Screen
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.White

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AlertsScreen(navController: NavController, innerPadding: PaddingValues) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Black)
            .padding(innerPadding),
        contentPadding = PaddingValues(start = 20.dp, top = 16.dp, end = 20.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column {
                    Text("Alerts", color = White, fontWeight = FontWeight.Bold, fontSize = 24.sp)
                    Text("Threats detected by BantAI", color = TextSecondary, fontSize = 12.sp)
                }
                Box(
                    modifier = Modifier
                        .background(Color(0xFF0A2A0A), RoundedCornerShape(100.dp))
                        .border(1.dp, Safe, RoundedCornerShape(100.dp))
                        .padding(horizontal = 10.dp, vertical = 5.dp),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Icon(Icons.Default.Shield, contentDescription = null, tint = Safe, modifier = Modifier.size(14.dp))
                        Text("All reviewed", color = Safe, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                    }
                }
            }
        }

        // Card 1 — Auto-blocked smishing (GCash Alert)
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Surface, RoundedCornerShape(16.dp))
                    .clickable { navController.navigate(Screen.SmishingAlert.route) }
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
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
                        Icon(Icons.Default.Block, contentDescription = null, tint = Danger, modifier = Modifier.size(18.dp))
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text("GCash Alert", color = White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Text("+63 908 000 1234", color = TextSecondary, fontSize = 12.sp)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("9:01 AM", color = TextSecondary, fontSize = 11.sp)
                        Spacer(Modifier.height(4.dp))
                        Box(
                            modifier = Modifier
                                .background(Color(0xFF2A0A0A), RoundedCornerShape(100.dp))
                                .border(1.dp, Danger, RoundedCornerShape(100.dp))
                                .padding(horizontal = 8.dp, vertical = 3.dp),
                        ) {
                            Text("Auto-blocked", color = Danger, fontSize = 10.sp, fontWeight = FontWeight.Medium)
                        }
                    }
                }
                Text(
                    "Your account has been flagged. Verify now at gcash-ph-support.net/verify...",
                    color = TextSecondary,
                    fontSize = 13.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    "WHY IT WAS FLAGGED",
                    color = Color(0xFF666666),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium,
                    letterSpacing = 0.8.sp,
                )
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("× Fake domain in link", "× Urgency keywords detected", "× Brand impersonation (GCash)").forEach { tag ->
                        Box(
                            modifier = Modifier
                                .background(Color(0xFF2A0A0A), RoundedCornerShape(100.dp))
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                        ) {
                            Text(tag, color = Danger, fontSize = 10.sp)
                        }
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(Icons.Default.Hub, contentDescription = null, tint = Suspicious, modifier = Modifier.size(14.dp))
                    Text("Operation GCash Clone #14", color = Suspicious, fontSize = 12.sp)
                }
            }
        }

        // Card 2 — Auto-blocked smishing (unknown sender)
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Surface, RoundedCornerShape(16.dp))
                    .clickable { navController.navigate(Screen.SmishingAlert.route) }
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
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
                        Icon(Icons.Default.Block, contentDescription = null, tint = Danger, modifier = Modifier.size(18.dp))
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text("+63 908 111 2222", color = White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Text("+63 908 111 2222", color = TextSecondary, fontSize = 12.sp)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("Yesterday", color = TextSecondary, fontSize = 11.sp)
                        Spacer(Modifier.height(4.dp))
                        Box(
                            modifier = Modifier
                                .background(Color(0xFF2A0A0A), RoundedCornerShape(100.dp))
                                .border(1.dp, Danger, RoundedCornerShape(100.dp))
                                .padding(horizontal = 8.dp, vertical = 3.dp),
                        ) {
                            Text("Auto-blocked", color = Danger, fontSize = 10.sp, fontWeight = FontWeight.Medium)
                        }
                    }
                }
                Text(
                    "Congratulations! You've been selected for a ₱5,000 GCash reward. Claim at...",
                    color = TextSecondary,
                    fontSize = 13.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    "WHY IT WAS FLAGGED",
                    color = Color(0xFF666666),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium,
                    letterSpacing = 0.8.sp,
                )
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("× Credential request via link", "× Reward bait language", "× Unknown sender").forEach { tag ->
                        Box(
                            modifier = Modifier
                                .background(Color(0xFF2A0A0A), RoundedCornerShape(100.dp))
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                        ) {
                            Text(tag, color = Danger, fontSize = 10.sp)
                        }
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(Icons.Default.Hub, contentDescription = null, tint = Suspicious, modifier = Modifier.size(14.dp))
                    Text("Operation GCash Clone #14", color = Suspicious, fontSize = 12.sp)
                }
            }
        }

        // Card 3 — Suspicious (not auto-blocked, BDO Online)
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Surface, RoundedCornerShape(16.dp))
                    .clickable { navController.navigate(Screen.ThreatAnalysis.route) }
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .background(Color(0xFF2A1A00), RoundedCornerShape(8.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Default.Warning, contentDescription = null, tint = Suspicious, modifier = Modifier.size(18.dp))
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text("BDO Online", color = White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Text("+63 2 8631 8000", color = TextSecondary, fontSize = 12.sp)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("18m", color = TextSecondary, fontSize = 11.sp)
                        Spacer(Modifier.height(4.dp))
                        Box(
                            modifier = Modifier
                                .background(Color(0xFF2A1A00), RoundedCornerShape(100.dp))
                                .border(1.dp, Suspicious, RoundedCornerShape(100.dp))
                                .padding(horizontal = 8.dp, vertical = 3.dp),
                        ) {
                            Text("Suspicious", color = Suspicious, fontSize = 10.sp, fontWeight = FontWeight.Medium)
                        }
                    }
                }
                Text(
                    "You have a pending transaction of ₱12,500. Tap to review and confirm.",
                    color = TextSecondary,
                    fontSize = 13.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    "WHY IT WAS FLAGGED",
                    color = Color(0xFF666666),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium,
                    letterSpacing = 0.8.sp,
                )
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("Unverified sender domain", "Urgency language", "Contains shortened URL").forEach { tag ->
                        Box(
                            modifier = Modifier
                                .background(Color(0xFF2A1A00), RoundedCornerShape(100.dp))
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                        ) {
                            Text(tag, color = Suspicious, fontSize = 10.sp)
                        }
                    }
                }
            }
        }
    }
}
