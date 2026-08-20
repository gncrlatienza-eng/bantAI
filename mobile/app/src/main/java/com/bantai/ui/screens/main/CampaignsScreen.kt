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
import androidx.compose.material.icons.filled.HourglassEmpty
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.data.remote.CampaignsApi
import com.bantai.navigation.Screen
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White
import com.bantai.viewmodel.CampaignsViewModel
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun CampaignsScreen(
    navController: NavController,
    innerPadding: PaddingValues,
    viewModel: CampaignsViewModel = viewModel(),
) {
    val activeCampaigns by viewModel.activeCampaigns.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val inactiveCampaigns by viewModel.inactiveCampaigns.collectAsState()
    val isLoadingInactive by viewModel.isLoadingInactive.collectAsState()
    val inactiveErrorMessage by viewModel.inactiveErrorMessage.collectAsState()

    LazyColumn(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black)
                .statusBarsPadding(),
        contentPadding =
            PaddingValues(
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
            when {
                isLoading -> LoadingRow()
                errorMessage != null -> InfoRow(errorMessage ?: "Could not load campaigns", isError = true)
                activeCampaigns.isEmpty() -> InfoRow("No active campaigns right now")
                else ->
                    GroupedList(
                        items = activeCampaigns,
                        onClick = { campaign -> navController.navigate(Screen.CampaignDetail.createRoute(campaign.id)) },
                    )
            }
            Spacer(Modifier.height(24.dp))
        }

        item {
            SectionHeader("PAST CAMPAIGNS")
            when {
                isLoadingInactive -> LoadingRow()
                inactiveErrorMessage != null -> InfoRow(inactiveErrorMessage ?: "Could not load past campaigns", isError = true)
                inactiveCampaigns.isEmpty() -> InfoRow("No past campaigns yet")
                else ->
                    GroupedList(
                        items = inactiveCampaigns,
                        onClick = { campaign -> navController.navigate(Screen.CampaignDetail.createRoute(campaign.id)) },
                    )
            }
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
private fun LoadingRow() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(SurfaceElevated)
                .padding(20.dp),
        horizontalArrangement = Arrangement.Center,
    ) {
        CircularProgressIndicator(color = TextSecondary, modifier = Modifier.size(20.dp))
    }
}

@Composable
private fun InfoRow(
    message: String,
    isError: Boolean = false,
    icon: androidx.compose.ui.graphics.vector.ImageVector = Icons.Default.HourglassEmpty,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(SurfaceElevated)
                .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(icon, contentDescription = null, tint = if (isError) Danger else TextTertiary, modifier = Modifier.size(18.dp))
        Text(message, color = if (isError) Danger else TextSecondary, fontSize = 13.sp)
    }
}

@Composable
private fun GroupedList(
    items: List<CampaignsApi.CampaignSummary>,
    onClick: (CampaignsApi.CampaignSummary) -> Unit,
) {
    Column(
        modifier =
            Modifier
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
private fun CampaignRow(
    campaign: CampaignsApi.CampaignSummary,
    onClick: () -> Unit,
) {
    val accent = if (campaign.isActive) Suspicious else TextTertiary

    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
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
                campaign.label ?: "Unlabeled campaign",
                color = White,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(2.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier =
                        Modifier
                            .size(6.dp)
                            .background(if (campaign.isActive) Safe else TextTertiary, CircleShape),
                )
                Spacer(Modifier.width(5.dp))
                Text(
                    buildString {
                        append(if (campaign.isActive) "Active" else "Ended")
                        append(" · ${campaign.messageCount} messages")
                    },
                    color = TextSecondary,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Spacer(Modifier.width(8.dp))
        Text(formatShortDate(campaign.createdAt), color = TextTertiary, fontSize = 12.sp)
        Icon(
            Icons.Default.ChevronRight,
            contentDescription = null,
            tint = TextTertiary,
            modifier = Modifier.size(18.dp),
        )
    }
}

private fun formatShortDate(iso: String): String =
    try {
        Instant.parse(iso).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("MMM d", Locale.US))
    } catch (_: Exception) {
        ""
    }
