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
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.navigation.Screen
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextTertiary
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

    val active = campaigns.filter { it.isActive }
    val past = campaigns.filter { !it.isActive }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Black)
            .statusBarsPadding(),
        contentPadding = PaddingValues(
            start = 20.dp,
            top = 16.dp,
            end = 20.dp,
            bottom = innerPadding.calculateBottomPadding() + 24.dp,
        ),
    ) {
        item {
            Text("Campaigns", color = White, fontWeight = FontWeight.Bold, fontSize = 32.sp)
            Spacer(Modifier.height(4.dp))
            Text("Coordinated smishing waves", color = TextSecondary, fontSize = 14.sp)
            Spacer(Modifier.height(20.dp))
        }

        item {
            SectionHeader("ACTIVE")
            GroupedList(
                items = active,
                onClick = { navController.navigate(Screen.CampaignDetail.createRoute(true)) },
            )
            Spacer(Modifier.height(24.dp))
        }

        item {
            SectionHeader("PAST CAMPAIGNS")
            GroupedList(
                items = past,
                onClick = { showInactiveModal = true },
            )
        }
    }
}

@Composable
private fun SectionHeader(label: String) {
    Text(
        label,
        color = TextTertiary,
        fontSize = 13.sp,
        fontWeight = FontWeight.Medium,
        letterSpacing = 0.5.sp,
        modifier = Modifier.padding(start = 16.dp, bottom = 8.dp),
    )
}

@Composable
private fun GroupedList(items: List<Campaign>, onClick: (Campaign) -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(SurfaceElevated),
    ) {
        items.forEachIndexed { index, campaign ->
            CampaignRow(campaign = campaign, onClick = { onClick(campaign) })
            if (index < items.lastIndex) {
                HorizontalDivider(
                    color = Hairline,
                    thickness = 0.5.dp,
                    modifier = Modifier.padding(start = 66.dp),
                )
            }
        }
    }
}

@Composable
private fun CampaignRow(campaign: Campaign, onClick: () -> Unit) {
    val accent = if (campaign.isActive) Suspicious else TextTertiary

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .background(accent.copy(alpha = 0.15f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Default.Hub,
                contentDescription = null,
                tint = accent,
                modifier = Modifier.size(18.dp),
            )
        }
        Spacer(Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                campaign.name,
                color = White,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(2.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(6.dp)
                        .background(if (campaign.isActive) Safe else TextTertiary, CircleShape),
                )
                Spacer(Modifier.width(5.dp))
                Text(
                    buildString {
                        append(if (campaign.isActive) "Active" else "Ended")
                        append(" · ${campaign.messages} messages")
                    },
                    color = TextSecondary,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Spacer(Modifier.width(8.dp))
        Text(campaign.since, color = TextTertiary, fontSize = 12.sp)
        Icon(
            Icons.Default.ChevronRight,
            contentDescription = null,
            tint = TextTertiary,
            modifier = Modifier.size(18.dp),
        )
    }
}

@Composable
private fun InactiveCampaignModal(onDismiss: () -> Unit, onViewDetails: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = SurfaceElevated,
        shape = RoundedCornerShape(20.dp),
        title = null,
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Icon(Icons.Default.Lock, contentDescription = null, tint = TextTertiary, modifier = Modifier.size(32.dp))
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
