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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBackIos
import androidx.compose.material.icons.automirrored.filled.Message
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.People
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
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
import com.bantai.ui.components.DetailSkeleton
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.GlassStroke
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextTertiary
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
        // iOS-style back affordance: chevron + the screen you're returning to,
        // not a generic "Back" label or a repeated page title -- matches the
        // alert detail screen's header.
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
                tint = Indigo,
                modifier = Modifier.size(16.dp),
            )
            Spacer(Modifier.width(2.dp))
            Text("Campaigns", color = Indigo, fontSize = 15.sp)
        }

        when {
            isLoading -> DetailSkeleton()
            errorMessage != null ->
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(errorMessage ?: "Could not load this campaign", color = Danger, fontSize = 14.sp)
                }
            campaign != null -> CampaignDetailContent(campaign!!)
        }
    }
}

@Composable
@Suppress("LongMethod", "MaxLineLength")
private fun CampaignDetailContent(campaign: CampaignsApi.CampaignDetail) {
    val blockedCount = campaign.messages.count { it.bucket == "blocked" }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        // Bottom clearance matches the floating tab bar's footprint (see
        // MainScreen) -- this screen now renders behind that persistent bar.
        contentPadding = PaddingValues(start = 20.dp, top = 4.dp, end = 20.dp, bottom = 116.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        // Header card
        item {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .background(SurfaceElevated, RoundedCornerShape(18.dp))
                        .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(44.dp)
                            .background(
                                if (campaign.isActive) Suspicious.copy(alpha = 0.15f) else Color.Transparent,
                                RoundedCornerShape(12.dp),
                            ).then(
                                if (!campaign.isActive) {
                                    Modifier.border(1.dp, GlassStroke, RoundedCornerShape(12.dp))
                                } else {
                                    Modifier
                                },
                            ),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Default.Hub,
                        contentDescription = null,
                        tint = if (campaign.isActive) Suspicious else TextTertiary,
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
                                        .size(6.dp)
                                        .background(Safe, CircleShape),
                            )
                            Text("Active · Since ${formatShortDate(campaign.createdAt)}", color = Safe, fontSize = 12.sp)
                        }
                    } else {
                        Box(
                            modifier =
                                Modifier
                                    .padding(top = 4.dp)
                                    .background(Hairline, RoundedCornerShape(100.dp))
                                    .padding(horizontal = 8.dp, vertical = 3.dp),
                        ) {
                            Text("Inactive", color = TextTertiary, fontSize = 11.sp, fontWeight = FontWeight.Medium)
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
                        value = "Private",
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

        // Known domains -- one grouped card of divided rows instead of a
        // separate little card per domain.
        item {
            SectionLabel("KNOWN DOMAINS")
            if (campaign.urlDomains.isEmpty()) {
                EmptySectionRow("No known domains yet")
            } else {
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(SurfaceElevated, RoundedCornerShape(18.dp)),
                ) {
                    campaign.urlDomains.forEachIndexed { index, domain ->
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 13.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            Icon(Icons.Default.Link, contentDescription = null, tint = Danger, modifier = Modifier.size(16.dp))
                            Text(domain, color = Danger, fontSize = 13.sp)
                        }
                        if (index != campaign.urlDomains.lastIndex) {
                            HorizontalDivider(color = Hairline, modifier = Modifier.padding(start = 16.dp))
                        }
                    }
                }
            }
        }

        // This advice is derived from the campaign evidence currently returned
        // by the backend, not a generic warning shown for every cluster.
        item {
            SectionLabel("CAMPAIGN-SPECIFIC ADVICE")
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .background(Surface, RoundedCornerShape(12.dp))
                        .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                campaignAdvice(campaign).forEach { advice ->
                    Text("• $advice", color = TextSecondary, fontSize = 13.sp, lineHeight = 19.sp)
                }
            }
        }

        // Recent messages
        item {
            SectionLabel("RECENT MESSAGES")
            if (campaign.messages.isEmpty()) {
                EmptySectionRow("No messages recorded for this campaign yet")
            } else {
                val recentMessages = campaign.messages.take(10)
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(SurfaceElevated, RoundedCornerShape(18.dp)),
                ) {
                    recentMessages.forEachIndexed { index, message ->
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text("Private device record", color = White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                Text(
                                    message.label ?: message.bucket ?: "Unclassified",
                                    color = if (message.bucket == "blocked") Danger else TextSecondary,
                                    fontSize = 11.sp,
                                )
                            }
                            Text(
                                "Message content remains on your device.",
                                color = TextSecondary,
                                fontSize = 12.sp,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        if (index != recentMessages.lastIndex) {
                            HorizontalDivider(color = Hairline, modifier = Modifier.padding(start = 16.dp))
                        }
                    }
                }
            }
        }
    }
}

@Suppress("MaxLineLength")
private fun campaignAdvice(campaign: CampaignsApi.CampaignDetail): List<String> {
    val evidence = (listOfNotNull(campaign.label) + campaign.urlDomains).joinToString(" ").lowercase()
    val advice = mutableListOf<String>()

    if (campaign.urlDomains.isNotEmpty()) {
        advice += "Do not open links from this campaign. Use the provider's official app or type its known address yourself."
    }
    if (listOf("gcash", "maya", "bank", "bdo", "bpi", "wallet", "otp", "pin").any { it in evidence }) {
        advice += "Never share an OTP, PIN, password, or recovery code. Contact the financial provider only through its verified channel."
    }
    if (listOf("job", "loan", "prize", "winner", "reward", "cash").any { it in evidence }) {
        advice += "Do not pay a fee or send money to claim a prize, loan, job, or reward. Verify the offer independently first."
    }
    if (advice.isEmpty()) {
        advice += "Do not reply or share personal information. Keep the message as evidence and report it if it asks for urgent action."
    }
    advice += "Blocking is recommended if you did not initiate this conversation."
    return advice.distinct()
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text,
        color = TextTertiary,
        fontSize = 12.sp,
        fontWeight = FontWeight.Medium,
        letterSpacing = 0.6.sp,
        modifier = Modifier.padding(bottom = 8.dp),
    )
}

@Composable
private fun EmptySectionRow(message: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(SurfaceElevated, RoundedCornerShape(18.dp))
                .padding(16.dp),
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
                .background(SurfaceElevated, RoundedCornerShape(16.dp))
                .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(icon, contentDescription = null, tint = TextTertiary, modifier = Modifier.size(16.dp))
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
