package com.bantai.ui.screens.main

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Message
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.People
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.data.remote.CampaignsApi
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.BorderColor
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.White
import com.bantai.viewmodel.CampaignDetailViewModel
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun CampaignDetailScreen(
    campaignId: String,
    navController: NavController,
    viewModel: CampaignDetailViewModel = viewModel(),
) {
    val campaign by viewModel.campaign.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()

    LaunchedEffect(campaignId) { viewModel.loadCampaign(campaignId) }

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
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = White)
            }
            Text(
                "Campaign",
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp,
                modifier = Modifier.align(Alignment.Center),
            )
        }
        HorizontalDivider(color = Surface)

        when {
            isLoading ->
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = TextSecondary)
                }
            errorMessage != null ->
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(errorMessage ?: "Could not load this campaign", color = Danger, fontSize = 14.sp)
                }
            campaign != null -> CampaignDetailContent(campaign!!)
        }
    }
}

@Composable
private fun CampaignDetailContent(campaign: CampaignsApi.CampaignDetail) {
    val uniqueSenders =
        campaign.messages
            .map { it.sender }
            .distinct()
            .size
    val blockedCount = campaign.messages.count { it.bucket == "blocked" }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 20.dp, top = 12.dp, end = 20.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Header card
        item {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .background(Surface, RoundedCornerShape(16.dp))
                        .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(44.dp)
                            .background(
                                if (campaign.isActive) Color(0xFF2A1A00) else Color.Transparent,
                                RoundedCornerShape(12.dp),
                            ).then(
                                if (!campaign.isActive) {
                                    Modifier.border(1.dp, BorderColor, RoundedCornerShape(12.dp))
                                } else {
                                    Modifier
                                },
                            ),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Default.Hub,
                        contentDescription = null,
                        tint = if (campaign.isActive) Suspicious else Color(0xFF666666),
                        modifier = Modifier.size(22.dp),
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        campaign.label ?: "Unlabeled campaign",
                        color = White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        lineHeight = 22.sp,
                    )
                    if (campaign.isActive) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            modifier = Modifier.padding(top = 4.dp),
                        ) {
                            Box(
                                modifier =
                                    Modifier
                                        .size(8.dp)
                                        .background(Safe, RoundedCornerShape(100.dp)),
                            )
                            Text("Active · Since ${formatShortDate(campaign.createdAt)}", color = Safe, fontSize = 12.sp)
                        }
                    } else {
                        Box(
                            modifier =
                                Modifier
                                    .padding(top = 4.dp)
                                    .background(BorderColor, RoundedCornerShape(100.dp))
                                    .padding(horizontal = 8.dp, vertical = 3.dp),
                        ) {
                            Text("Inactive", color = Color(0xFF666666), fontSize = 11.sp, fontWeight = FontWeight.Medium)
                        }
                    }
                }
            }
        }

        // 2x2 stats grid
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    StatCard(
                        icon = Icons.AutoMirrored.Filled.Message,
                        value = campaign.messageCount.toString(),
                        label = "Messages",
                        modifier = Modifier.weight(1f),
                    )
                    StatCard(
                        icon = Icons.Default.Link,
                        value = campaign.urlDomains.size.toString(),
                        label = "Domains",
                        modifier = Modifier.weight(1f),
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    StatCard(
                        icon = Icons.Default.People,
                        value = uniqueSenders.toString(),
                        label = "Senders (recent)",
                        modifier = Modifier.weight(1f),
                    )
                    StatCard(
                        icon = Icons.Default.Block,
                        value = blockedCount.toString(),
                        label = "Blocked (recent)",
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }

        // Known domains
        item {
            SectionLabel("KNOWN DOMAINS")
            if (campaign.urlDomains.isEmpty()) {
                EmptySectionRow("No known domains yet")
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    campaign.urlDomains.forEach { domain ->
                        Row(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .background(Surface, RoundedCornerShape(12.dp))
                                    .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            Icon(Icons.Default.Link, contentDescription = null, tint = Danger, modifier = Modifier.size(16.dp))
                            Text(domain, color = Danger, fontSize = 13.sp)
                        }
                    }
                }
            }
        }

        // Recent messages
        item {
            SectionLabel("RECENT MESSAGES")
            if (campaign.messages.isEmpty()) {
                EmptySectionRow("No messages recorded for this campaign yet")
            } else {
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(Surface, RoundedCornerShape(16.dp))
                            .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    campaign.messages.take(10).forEach { message ->
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(message.sender, color = White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                Text(
                                    message.label ?: message.bucket ?: "Unclassified",
                                    color = if (message.bucket == "blocked") Danger else TextSecondary,
                                    fontSize = 11.sp,
                                )
                            }
                            Text(
                                message.body,
                                color = TextSecondary,
                                fontSize = 12.sp,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
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
        modifier = Modifier.padding(top = 4.dp, bottom = 8.dp),
    )
}

@Composable
private fun EmptySectionRow(message: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(Surface, RoundedCornerShape(12.dp))
                .padding(12.dp),
    ) {
        Text(message, color = TextSecondary, fontSize = 13.sp)
    }
}

@Composable
private fun StatCard(
    icon: ImageVector,
    value: String,
    label: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .background(Surface, RoundedCornerShape(12.dp))
                .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(icon, contentDescription = null, tint = Color(0xFF666666), modifier = Modifier.size(16.dp))
        Text(value, color = White, fontWeight = FontWeight.Bold, fontSize = 22.sp)
        Text(label, color = TextSecondary, fontSize = 12.sp)
    }
}

private fun formatShortDate(iso: String): String =
    try {
        Instant.parse(iso).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("MMM d", Locale.US))
    } catch (_: Exception) {
        "an unknown date"
    }
