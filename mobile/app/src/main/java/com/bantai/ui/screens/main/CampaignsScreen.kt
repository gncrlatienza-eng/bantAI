package com.bantai.ui.screens.main

import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
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
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.HourglassEmpty
import androidx.compose.material.icons.outlined.Forum
import androidx.compose.material.icons.outlined.Hub
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.ReportGmailerrorred
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.data.model.GroupReason
import com.bantai.data.model.LocalCampaign
import com.bantai.data.model.LocalScamMessage
import com.bantai.navigation.Screen
import com.bantai.ui.components.MessageRowSkeleton
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.SystemGray
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White
import com.bantai.util.SmsLinkSafety
import com.bantai.viewmodel.CampaignsUiState
import com.bantai.viewmodel.CampaignsViewModel
import com.bantai.viewmodel.OpenTarget
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * This phone's scam campaigns, grouped on the device from this phone's own
 * messages (see LocalCampaigns.kt): known campaigns by category first, then
 * groups found only here, then scams that fit no group.
 */
@Composable
@Suppress("LongMethod") // one LazyColumn describing the tab's sections, top to bottom
fun CampaignsScreen(
    navController: NavController,
    innerPadding: PaddingValues,
    viewModel: CampaignsViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsState()
    // Open rows live in the ViewModel, so they survive leaving and coming back.
    val expanded = viewModel.expanded

    // The ViewModel outlives this tab; re-reading on each visit picks up new
    // messages and retries matching after an earlier outage.
    LaunchedEffect(Unit) { viewModel.loadCampaigns() }

    val context = LocalContext.current
    val openThread: (LocalScamMessage) -> Unit = { message ->
        viewModel.resolveOpenTarget(message) { target -> openTarget(target, navController, context) }
    }
    val openCampaign: (String) -> Unit = { navController.navigate(Screen.CampaignDetail.createRoute(it)) }

    // Same layout as the Messages and Alerts tabs: the title stays pinned
    // while only the list below scrolls. Rows sit on the page with inset
    // hairlines instead of inside rounded cards.
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black)
                .statusBarsPadding(),
    ) {
        Spacer(Modifier.height(16.dp))
        Column(modifier = Modifier.padding(horizontal = 20.dp)) {
            Text("Campaigns", color = White, fontWeight = FontWeight.Bold, fontSize = TextSize.LargeTitle)
            Spacer(Modifier.height(4.dp))
            Text("Scam waves on this phone", color = TextSecondary, fontSize = TextSize.Subhead)
            Spacer(Modifier.height(8.dp))
        }
        LazyColumn(
            modifier = Modifier.weight(1f).fillMaxWidth(),
            contentPadding = PaddingValues(bottom = innerPadding.calculateBottomPadding() + 24.dp),
        ) {
            campaignItems(state, expanded, openThread, openCampaign)
        }
    }
}

// Everything below the pinned title, as list items.
private fun LazyListScope.campaignItems(
    state: CampaignsUiState,
    expanded: MutableMap<String, Boolean>,
    openThread: (LocalScamMessage) -> Unit,
    openCampaign: (String) -> Unit,
) {
    val overview = state.overview
    state.matchingProgress?.let { progress ->
        item { MatchingProgressRow(progress) }
    }
    state.matchingNote?.let { note ->
        item { InfoRow(note) }
    }

    when {
        state.isLoading -> item { LoadingRow() }
        state.errorMessage != null -> item { InfoRow(state.errorMessage ?: "", isError = true) }
        overview == null || overview.isEmpty ->
            item { EmptyCampaigns(Modifier.fillParentMaxSize()) }
        else -> {
            overview.sections.forEach { section ->
                item(key = "section:${section.category}") {
                    SectionHeader(section.category, countLabel(section.messageCount))
                }
                item(key = "cards:${section.category}") {
                    CampaignCardGroup(section.campaigns, expanded, openThread, openCampaign)
                }
            }

            if (overview.unmatched.isNotEmpty()) {
                item(key = "section:unmatched") { SectionHeader("Not part of a campaign") }
                item(key = "cards:unmatched") {
                    UnmatchedCard(
                        messages = overview.unmatched,
                        isExpanded = expanded["unmatched"] == true,
                        onToggle = { expanded["unmatched"] = expanded["unmatched"] != true },
                        openThread = openThread,
                    )
                }
            }

            if (overview.hiddenPromoCount > 0) {
                item(key = "promo") {
                    Text(
                        "${countLabel(overview.hiddenPromoCount)} matched promo campaigns and are hidden here.",
                        color = TextTertiary,
                        fontSize = TextSize.Caption,
                        modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 16.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun CampaignCardGroup(
    campaigns: List<LocalCampaign>,
    expanded: MutableMap<String, Boolean>,
    openThread: (LocalScamMessage) -> Unit,
    openCampaign: (String) -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        campaigns.forEachIndexed { index, campaign ->
            CampaignCard(
                campaign = campaign,
                isExpanded = expanded[campaign.key] == true,
                onToggle = { expanded[campaign.key] = expanded[campaign.key] != true },
                openThread = openThread,
                openCampaign = openCampaign,
            )
            if (index < campaigns.lastIndex) {
                HorizontalDivider(
                    color = Hairline,
                    thickness = 0.5.dp,
                    modifier = Modifier.padding(start = ROW_TEXT_INSET),
                )
            }
        }
    }
}

@Composable
@Suppress("LongMethod") // header row + expandable message list, kept together for readability
private fun CampaignCard(
    campaign: LocalCampaign,
    isExpanded: Boolean,
    onToggle: () -> Unit,
    openThread: (LocalScamMessage) -> Unit,
    openCampaign: (String) -> Unit,
) {
    val (icon, accent) =
        when (campaign.reason) {
            GroupReason.AI_MATCH -> Icons.Outlined.Hub to Danger
            GroupReason.SAME_LINK -> Icons.Outlined.Link to Suspicious
            GroupReason.SIMILAR_WORDING -> Icons.Outlined.Forum to Suspicious
        }
    Column {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onToggle)
                    .padding(start = 20.dp, end = 14.dp, top = 10.dp, bottom = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AccentIcon(icon, accent)
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    campaign.title,
                    color = White,
                    fontWeight = FontWeight.Bold,
                    fontSize = TextSize.Body,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    buildString {
                        append(countLabel(campaign.messages.size))
                        append(" · ${campaign.senderCount} ${if (campaign.senderCount == 1) "sender" else "senders"}")
                        if (campaign.reason != GroupReason.AI_MATCH) append(" · ${campaign.category}")
                    },
                    color = TextSecondary,
                    fontSize = TextSize.Footnote,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Spacer(Modifier.width(8.dp))
            Text(formatShortDate(campaign.latestTimestamp), color = TextSecondary, fontSize = TextSize.Footnote)
            Icon(
                if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                contentDescription = if (isExpanded) "Collapse" else "Expand",
                tint = TextTertiary,
                modifier = Modifier.size(18.dp),
            )
        }
        AnimatedVisibility(visible = isExpanded) {
            Column(modifier = Modifier.padding(start = ROW_TEXT_INSET, end = 20.dp, bottom = 8.dp)) {
                campaign.messages.forEach { message -> MessagePreviewRow(message, openThread) }
                campaign.clusterId?.let { clusterId ->
                    Text(
                        "View campaign details",
                        color = Indigo,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = TextSize.Footnote,
                        modifier =
                            Modifier
                                .clickable { openCampaign(clusterId) }
                                .padding(vertical = 10.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun UnmatchedCard(
    messages: List<LocalScamMessage>,
    isExpanded: Boolean,
    onToggle: () -> Unit,
    openThread: (LocalScamMessage) -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onToggle)
                    .padding(start = 20.dp, end = 14.dp, top = 10.dp, bottom = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AccentIcon(Icons.Outlined.ReportGmailerrorred, SystemGray)
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text("One-off scams", color = White, fontWeight = FontWeight.Bold, fontSize = TextSize.Body)
                Spacer(Modifier.height(2.dp))
                Text(
                    "${countLabel(messages.size)} that don't match any other",
                    color = TextSecondary,
                    fontSize = TextSize.Footnote,
                )
            }
            Icon(
                if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                contentDescription = if (isExpanded) "Collapse" else "Expand",
                tint = TextTertiary,
                modifier = Modifier.size(18.dp),
            )
        }
        AnimatedVisibility(visible = isExpanded) {
            Column(modifier = Modifier.padding(start = ROW_TEXT_INSET, end = 20.dp, bottom = 8.dp)) {
                messages.forEach { message -> MessagePreviewRow(message, openThread) }
            }
        }
    }
}

@Composable
private fun MessagePreviewRow(
    message: LocalScamMessage,
    openThread: (LocalScamMessage) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable { openThread(message) }
                .padding(vertical = 8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                message.sender.ifBlank { "Unknown sender" },
                color = White,
                fontWeight = FontWeight.SemiBold,
                fontSize = TextSize.Footnote,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Text(formatShortDate(message.timestamp), color = TextTertiary, fontSize = TextSize.Caption2)
        }
        Text(
            SmsLinkSafety.hideLinks(message.body),
            color = TextSecondary,
            fontSize = TextSize.Caption,
            lineHeight = 16.sp,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun AccentIcon(
    icon: ImageVector,
    accent: androidx.compose.ui.graphics.Color,
) {
    Box(
        modifier =
            Modifier
                .size(32.dp)
                .background(accent.copy(alpha = 0.14f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(16.dp))
    }
}

@Composable
private fun MatchingProgressRow(progress: String) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(progress, color = TextSecondary, fontSize = TextSize.Footnote)
        LinearProgressIndicator(modifier = Modifier.fillMaxWidth(), color = Safe, trackColor = Hairline)
    }
}

@Composable
private fun SectionHeader(
    title: String,
    detail: String? = null,
) {
    Row(
        modifier = Modifier.padding(start = 20.dp, top = 20.dp, end = 20.dp, bottom = 4.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        Text(
            title,
            color = White,
            fontSize = TextSize.Body,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.weight(1f),
        )
        detail?.let { Text(it, color = TextSecondary, fontSize = TextSize.Footnote) }
    }
}

@Composable
private fun LoadingRow() {
    Column(modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
        repeat(LOADING_ROWS) {
            MessageRowSkeleton(avatarSize = 32.dp, horizontalPadding = 20.dp, verticalPadding = 10.dp)
        }
    }
}

@Composable
private fun InfoRow(
    message: String,
    isError: Boolean = false,
    icon: ImageVector = Icons.Default.HourglassEmpty,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(icon, contentDescription = null, tint = if (isError) Danger else TextTertiary, modifier = Modifier.size(18.dp))
        Text(message, color = if (isError) Danger else TextSecondary, fontSize = TextSize.Footnote)
    }
}

@Composable
private fun EmptyCampaigns(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.padding(horizontal = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(Icons.Outlined.Shield, contentDescription = null, tint = Safe, modifier = Modifier.size(44.dp))
        Spacer(Modifier.height(12.dp))
        Text("No scam campaigns", color = White, fontWeight = FontWeight.SemiBold, fontSize = TextSize.Headline)
        Spacer(Modifier.height(4.dp))
        Text(
            "When several scam texts share a link or wording, BantAI groups them here.",
            color = TextSecondary,
            fontSize = TextSize.Subhead,
            textAlign = TextAlign.Center,
        )
    }
}

private fun openTarget(
    target: OpenTarget,
    navController: NavController,
    context: android.content.Context,
) {
    when (target) {
        is OpenTarget.Thread -> navController.navigate(Screen.Detail.createRoute(target.sender))
        is OpenTarget.Alert -> navController.navigate(Screen.SmishingAlert.createRoute(target.backendMessageId))
        OpenTarget.Unavailable ->
            Toast.makeText(context, "Connect to the server to open this scam alert", Toast.LENGTH_SHORT).show()
    }
}

// Where a row's text column starts (20dp gutter + 32dp icon + 12dp gap);
// separators and expanded message lists line up with it.
private val ROW_TEXT_INSET = 64.dp
private const val LOADING_ROWS = 3

private fun countLabel(count: Int) = if (count == 1) "1 message" else "$count messages"

private fun formatShortDate(timestamp: Long): String =
    Instant
        .ofEpochMilli(timestamp)
        .atZone(ZoneId.systemDefault())
        .format(DateTimeFormatter.ofPattern("MMM d", Locale.US))
