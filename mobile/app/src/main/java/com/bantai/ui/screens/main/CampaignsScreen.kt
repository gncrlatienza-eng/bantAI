package com.bantai.ui.screens.main

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.navigation.Screen
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.BorderColor
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.White

private data class Campaign(
    val name: String,
    val isActive: Boolean,
    val messages: Int,
    val domains: Int,
    val since: String,
)

private val campaigns = listOf(
    Campaign("Operation GCash Clone #14", true,  248, 4, "May 3"),
    Campaign("BDO Fake Support Wave",     true,  134, 2, "May 7"),
    Campaign("Shopee Prize Scam #6",      false, 89,  3, "Apr 22"),
    Campaign("Piso Fare Lure",            false, 56,  1, "Apr 15"),
    Campaign("Landline OTP Intercept",    false, 31,  2, "Apr 8"),
)

@Composable
fun CampaignsScreen(navController: NavController, innerPadding: PaddingValues) {
    var showInactiveModal by remember { mutableStateOf(false) }

    if (showInactiveModal) {
        InactiveCampaignModal(
            onDismiss = { showInactiveModal = false },
            onViewDetails = {
                showInactiveModal = false
                navController.navigate(Screen.CampaignDetail.createRoute(false))
            },
        )
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Black)
            .padding(innerPadding),
        contentPadding = PaddingValues(start = 20.dp, top = 16.dp, end = 20.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Column {
                Text("Campaigns", color = White, fontWeight = FontWeight.Bold, fontSize = 24.sp)
                Text("Coordinated smishing waves", color = TextSecondary, fontSize = 12.sp)
            }
        }

        campaigns.forEach { campaign ->
            item {
                CampaignCard(
                    campaign = campaign,
                    onClick = {
                        if (campaign.isActive) {
                            navController.navigate(Screen.CampaignDetail.createRoute(true))
                        } else {
                            showInactiveModal = true
                        }
                    },
                )
            }
        }
    }
}

@Composable
private fun CampaignCard(campaign: Campaign, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Surface, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .background(
                        if (campaign.isActive) Color(0xFF2A1A00) else BorderColor,
                        RoundedCornerShape(10.dp),
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Default.Hub,
                    contentDescription = null,
                    tint = if (campaign.isActive) Suspicious else Color(0xFF666666),
                    modifier = Modifier.size(20.dp),
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    campaign.name,
                    color = White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    lineHeight = 19.sp,
                    maxLines = 2,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                )
                Box(
                    modifier = Modifier
                        .padding(top = 4.dp)
                        .background(
                            if (campaign.isActive) Color(0xFF0A2A0A) else BorderColor,
                            RoundedCornerShape(100.dp),
                        )
                        .padding(horizontal = 8.dp, vertical = 3.dp),
                ) {
                    Text(
                        if (campaign.isActive) "Active" else "Inactive",
                        color = if (campaign.isActive) Safe else Color(0xFF666666),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly,
        ) {
            StatCell(value = campaign.messages.toString(), label = "Messages")
            StatCell(value = campaign.domains.toString(), label = "Domains")
            StatCell(value = campaign.since, label = "Since")
        }
    }
}

@Composable
private fun StatCell(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, color = White, fontWeight = FontWeight.Bold, fontSize = 15.sp, maxLines = 1)
        Text(label, color = TextSecondary, fontSize = 10.sp, maxLines = 1)
    }
}

@Composable
private fun InactiveCampaignModal(onDismiss: () -> Unit, onViewDetails: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Surface,
        shape = RoundedCornerShape(20.dp),
        title = null,
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Icon(Icons.Default.Lock, contentDescription = null, tint = Color(0xFF666666), modifier = Modifier.size(32.dp))
                Text("Campaign inactive", color = White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Text(
                    "This campaign is no longer active. It has been archived for reference. No new messages or domains have been associated with it recently.",
                    color = TextSecondary,
                    fontSize = 13.sp,
                    lineHeight = 19.sp,
                )
                OutlinedButton(
                    onClick = onViewDetails,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF3A3A3A)),
                ) {
                    Icon(Icons.Default.Visibility, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(16.dp))
                    Box(Modifier.size(8.dp))
                    Text("View details anyway", color = White, fontSize = 14.sp)
                }
                TextButton(onClick = onDismiss) {
                    Text("Go back", color = TextSecondary, fontSize = 13.sp)
                }
            }
        },
        confirmButton = {},
    )
}
