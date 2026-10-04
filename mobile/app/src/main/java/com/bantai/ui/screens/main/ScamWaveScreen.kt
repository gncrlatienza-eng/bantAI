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
import androidx.compose.material.icons.automirrored.filled.ArrowBackIos
import androidx.compose.material.icons.outlined.Inbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.data.PublishedTips
import com.bantai.data.model.LocalCampaign
import com.bantai.data.model.LocalScamMessage
import com.bantai.data.model.linkDomains
import com.bantai.data.remote.TipsApi
import com.bantai.ui.components.LocalBottomBarClearance
import com.bantai.ui.components.StateMessage
import com.bantai.ui.screens.settings.PublishedTipCard
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.IosBlue
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.SystemGray
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White
import com.bantai.util.MessageTime
import com.bantai.util.SmsLinkSafety
import com.bantai.viewmodel.CampaignsViewModel

/**
 * One scam wave, opened from Scam Waves the way an alert opens from Alerts:
 * a pushed screen with Back, same header / bubble / short sections layout.
 * It replaced a bottom sheet that rose to the top of the screen and stacked
 * five boxed sections.
 *
 * Top to bottom: what it is (icon, name, count, Active/Inactive), what it
 * says (one sample, links hidden, the domains on one line under it), what
 * to do (two tips at most), and the texts you got.
 */
@Composable
fun ScamWaveScreen(
    waveKey: String,
    navController: NavController,
    /** Team tip to show opened, e.g. from its notification. */
    openTipId: String? = null,
) {
    // The Scam Waves tab's own ViewModel (scoped to "main"), so the wave is
    // already loaded; a fresh one only if "main" is somehow gone.
    val mainEntry: ViewModelStoreOwner? =
        remember(navController) { runCatching { navController.getBackStackEntry("main") }.getOrNull() }
    val viewModel: CampaignsViewModel = if (mainEntry != null) viewModel(mainEntry) else viewModel()
    val state by viewModel.state.collectAsState()
    LaunchedEffect(Unit) { if (state.overview == null) viewModel.loadCampaigns() }

    val wave =
        remember(state.overview, waveKey) {
            state.overview
                ?.sections
                ?.flatMap { it.campaigns }
                ?.firstOrNull { it.key == waveKey }
        }

    Column(Modifier.fillMaxSize().background(Black)) {
        BackRow(onBack = { navController.popBackStack() })
        when {
            wave != null ->
                WaveContent(
                    wave = wave,
                    openTipId = openTipId,
                    onOpenMessage = { message ->
                        viewModel.resolveOpenTarget(message) { target -> openTarget(target, navController) }
                    },
                )
            !state.isLoading ->
                StateMessage(
                    icon = Icons.Outlined.Inbox,
                    title = stringResource(R.string.wave_gone_title),
                    detail = stringResource(R.string.wave_gone_detail),
                )
        }
    }
}

// Same plain "Back" as the alert screen.
@Composable
private fun BackRow(onBack: () -> Unit) {
    Row(
        modifier =
            Modifier
                .statusBarsPadding()
                .padding(top = 6.dp)
                .clickable(onClick = onBack)
                .padding(horizontal = 12.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            Icons.AutoMirrored.Filled.ArrowBackIos,
            contentDescription = null,
            tint = IosBlue,
            modifier = Modifier.size(16.dp),
        )
        Spacer(Modifier.width(2.dp))
        Text(stringResource(R.string.action_back), color = IosBlue, fontSize = TextSize.Body)
    }
}

@Composable
private fun WaveContent(
    wave: LocalCampaign,
    openTipId: String?,
    onOpenMessage: (LocalScamMessage) -> Unit,
) {
    val domains = remember(wave) { wave.messages.flatMap { linkDomains(it.body) }.distinct() }
    val isActive = wave.isActive(System.currentTimeMillis())
    // Tips the BantAI team published for this kind of scam (Admin -> Tips,
    // "Campaign" field), matched on any of the wave's names.
    val teamTips by produceState(initialValue = emptyList<TipsApi.PublishedTip>(), wave.key) {
        value =
            PublishedTips.forWave(
                PublishedTips.load(),
                waveNames(wave),
            )
    }
    var expandedTip by rememberSaveable { mutableStateOf(openTipId) }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding =
            PaddingValues(start = 20.dp, top = 8.dp, end = 20.dp, bottom = LocalBottomBarClearance.current),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        item { WaveHeader(wave, isActive) }
        item { SampleBubble(wave, domains) }
        item {
            Section(stringResource(R.string.wave_what_to_do)) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    waveAdvice(wave, domains).forEach { advice ->
                        Text(stringResource(advice), color = White, fontSize = TextSize.Subhead, lineHeight = 20.sp)
                    }
                }
            }
        }
        if (teamTips.isNotEmpty()) {
            item {
                TeamTips(teamTips, expandedTip, onToggle = { id -> expandedTip = if (expandedTip == id) null else id })
            }
        }
        item {
            Section(stringResource(R.string.waves_your_texts)) {
                Column {
                    wave.messages.forEachIndexed { index, message ->
                        if (index > 0) HorizontalDivider(color = Hairline, thickness = 0.5.dp)
                        TextRow(message, onClick = { onOpenMessage(message) })
                    }
                }
            }
        }
    }
}

// The team's published tips for this wave, each opening in place.
@Composable
private fun TeamTips(
    tips: List<TipsApi.PublishedTip>,
    expandedTip: String?,
    onToggle: (String) -> Unit,
) {
    Column {
        Text(
            stringResource(R.string.wave_team_tips),
            color = TextSecondary,
            fontSize = TextSize.Footnote,
            modifier = Modifier.padding(start = 4.dp, bottom = 8.dp),
        )
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            tips.forEach { tip ->
                PublishedTipCard(
                    title = tip.title,
                    body = tip.body,
                    isExpanded = expandedTip == tip.id,
                    onToggle = { onToggle(tip.id) },
                )
            }
        }
    }
}

@Composable
private fun WaveHeader(
    wave: LocalCampaign,
    isActive: Boolean,
) {
    val category = friendlyCategory(wave.category)
    val tint = if (isActive) Danger else SystemGray
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            Modifier.size(64.dp).background(tint.copy(alpha = 0.15f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(category.icon, contentDescription = null, tint = tint, modifier = Modifier.size(30.dp))
        }
        Spacer(Modifier.height(12.dp))
        Text(
            waveTitle(wave),
            color = White,
            fontWeight = FontWeight.Bold,
            fontSize = TextSize.Title,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(2.dp))
        Text(countAndAge(wave), color = TextSecondary, fontSize = TextSize.Footnote)
        Spacer(Modifier.height(12.dp))
        // Same pill as an alert's verdict.
        Row(
            modifier =
                Modifier
                    .background(tint.copy(alpha = 0.15f), RoundedCornerShape(100.dp))
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(6.dp).background(tint, CircleShape))
            Spacer(Modifier.width(6.dp))
            Text(
                stringResource(if (isActive) R.string.waves_tab_active else R.string.waves_tab_ended),
                color = tint,
                fontWeight = FontWeight.SemiBold,
                fontSize = TextSize.Footnote,
            )
        }
    }
}

@Composable
private fun SampleBubble(
    wave: LocalCampaign,
    domains: List<String>,
) {
    Column {
        Text(
            SmsLinkSafety.hideLinks(wave.messages.first().body),
            color = White,
            fontSize = TextSize.Body,
            lineHeight = 21.sp,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(SurfaceElevated, RoundedCornerShape(18.dp))
                    .padding(horizontal = 16.dp, vertical = 14.dp),
        )
        if (domains.isNotEmpty()) {
            // Defanged so none of them can be tapped open.
            Text(
                stringResource(
                    R.string.wave_links_line,
                    domains.take(MAX_DOMAINS).joinToString(", ") { it.replace(".", "[.]") },
                ),
                color = TextSecondary,
                fontSize = TextSize.Footnote,
                modifier = Modifier.padding(start = 4.dp, top = 8.dp),
            )
        }
    }
}

// A small grey label over one rounded card, like "Why it was flagged" on an alert.
@Composable
private fun Section(
    title: String,
    content: @Composable () -> Unit,
) {
    Column {
        Text(
            title,
            color = TextSecondary,
            fontSize = TextSize.Footnote,
            modifier = Modifier.padding(start = 4.dp, bottom = 8.dp),
        )
        Box(Modifier.fillMaxWidth().background(SurfaceElevated, RoundedCornerShape(14.dp))) { content() }
    }
}

@Composable
private fun TextRow(
    message: LocalScamMessage,
    onClick: () -> Unit,
) {
    Column(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                message.sender.ifBlank { stringResource(R.string.unknown_sender) },
                color = White,
                fontWeight = FontWeight.SemiBold,
                fontSize = TextSize.Subhead,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Text(
                MessageTime.listLabel(LocalContext.current, message.timestamp),
                color = TextSecondary,
                fontSize = TextSize.Footnote,
            )
        }
        Text(
            SmsLinkSafety.hideLinks(message.body),
            color = TextSecondary,
            fontSize = TextSize.Footnote,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

private const val MAX_DOMAINS = 3
