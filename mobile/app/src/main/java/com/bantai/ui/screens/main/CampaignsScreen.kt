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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountBalance
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.Badge
import androidx.compose.material.icons.outlined.CardGiftcard
import androidx.compose.material.icons.outlined.Casino
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material.icons.outlined.Payments
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material.icons.outlined.Work
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.data.model.LocalCampaign
import com.bantai.data.model.OTHER_SCAM_CATEGORY
import com.bantai.navigation.Screen
import com.bantai.ui.components.MessageRowSkeleton
import com.bantai.ui.components.StateMessage
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.OnIndigo
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.SystemGray
import com.bantai.ui.theme.TabTitleTopSpacing
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White
import com.bantai.util.MessageTime
import com.bantai.util.SmsLinkSafety
import com.bantai.viewmodel.CampaignsUiState
import com.bantai.viewmodel.CampaignsViewModel
import com.bantai.viewmodel.OpenTarget

/**
 * Scam Waves (the Campaigns tab, hidden unless Settings → "Show Scam Waves
 * tab" is on). A wave is several scam texts on this phone that look like one
 * blast -- grouped on the device, see LocalCampaigns.kt.
 *
 * One flat list of cards, newest activity first, split Active / Inactive. Each
 * card says what the scam pretends to be, how many texts, when it was last
 * seen, and a sample. Tapping opens ScamWaveScreen, like an alert.
 *
 * This replaced a three-level layout (category sections → row → sheet →
 * separate detail screen) plus "Other scam texts" and footnotes, which users
 * found messy; a bottom sheet after that felt abrupt (it rose from the
 * bottom to the top). Single scams that belong to no wave already live in Alerts.
 */
@Composable
@Suppress("LongMethod") // pinned header + chips + list + sheet, one screen
fun CampaignsScreen(
    navController: NavController,
    innerPadding: PaddingValues,
    viewModel: CampaignsViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsState()
    var showEnded by rememberSaveable { mutableStateOf(false) }

    // The ViewModel outlives this tab. Each time the tab comes on screen it
    // refreshes only if a text arrived or a verdict changed since the last
    // load (the tab itself stays composed in the background, see MainScreen).
    // It refreshes in place -- the skeleton only shows before the first load.
    val tabActive = LocalTabActive.current
    LaunchedEffect(tabActive) { if (tabActive) viewModel.refreshIfStale() }

    val now = System.currentTimeMillis()
    val waves =
        remember(state.overview) {
            state.overview
                ?.sections
                ?.flatMap { it.campaigns }
                .orEmpty()
                .sortedByDescending { it.latestTimestamp }
        }
    val (active, ended) = waves.partition { it.isActive(now) }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black)
                .statusBarsPadding(),
    ) {
        Spacer(Modifier.height(TabTitleTopSpacing))
        Column(modifier = Modifier.padding(horizontal = 20.dp)) {
            Text(
                stringResource(R.string.campaign_detail_campaigns),
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = TextSize.LargeTitle,
            )
            Spacer(Modifier.height(2.dp))
            Text(
                state.matchingProgress ?: summaryLine(active.size),
                color = TextSecondary,
                fontSize = TextSize.Subhead,
            )
        }
        Spacer(Modifier.height(12.dp))
        WaveChips(showEnded = showEnded, onSelect = { showEnded = it })
        // A fixed gap outside the scrolling list: contentPadding's top only
        // applies at rest, so scrolled cards used to run right up against the
        // bottom edge of the Active / Inactive chips.
        Spacer(Modifier.height(10.dp))
        LazyColumn(
            modifier = Modifier.weight(1f).fillMaxWidth(),
            contentPadding =
                PaddingValues(
                    start = 16.dp,
                    end = 16.dp,
                    top = 4.dp,
                    bottom = innerPadding.calculateBottomPadding() + 24.dp,
                ),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            waveItems(
                state = state,
                waves = if (showEnded) ended else active,
                showEnded = showEnded,
                onRetry = { viewModel.loadCampaigns() },
                onOpen = { navController.navigate(Screen.ScamWave.createRoute(it.key)) },
            )
        }
    }
}

@Composable
private fun summaryLine(activeCount: Int): String =
    if (activeCount == 0) {
        stringResource(R.string.waves_summary_none)
    } else {
        pluralStringResource(R.plurals.waves_summary_active, activeCount, activeCount)
    }

@Composable
private fun WaveChips(
    showEnded: Boolean,
    onSelect: (Boolean) -> Unit,
) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 20.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(listOf(false, true)) { ended ->
            val isSelected = ended == showEnded
            Box(
                modifier =
                    Modifier
                        .heightIn(min = 36.dp)
                        .clip(RoundedCornerShape(100.dp))
                        .background(if (isSelected) Indigo else SurfaceElevated)
                        .clickable { onSelect(ended) }
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    stringResource(if (ended) R.string.waves_tab_ended else R.string.waves_tab_active),
                    color = if (isSelected) OnIndigo else White,
                    fontSize = TextSize.Subhead,
                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                )
            }
        }
    }
}

private fun LazyListScope.waveItems(
    state: CampaignsUiState,
    waves: List<LocalCampaign>,
    showEnded: Boolean,
    onRetry: () -> Unit,
    onOpen: (LocalCampaign) -> Unit,
) {
    when {
        state.isLoading -> item { LoadingRows() }
        state.errorMessage != null ->
            item {
                StateMessage(
                    icon = Icons.Outlined.CloudOff,
                    title = state.errorMessage,
                    actionLabel = stringResource(R.string.action_retry),
                    onAction = onRetry,
                    modifier = Modifier.fillParentMaxHeight(EMPTY_STATE_HEIGHT),
                )
            }
        waves.isEmpty() ->
            item {
                StateMessage(
                    icon = Icons.Outlined.Shield,
                    iconTint = Safe,
                    title =
                        stringResource(
                            if (showEnded) R.string.waves_empty_ended_title else R.string.waves_empty_active_title,
                        ),
                    detail = stringResource(R.string.campaigns_when_several_scam_texts_share),
                    modifier = Modifier.fillParentMaxHeight(EMPTY_STATE_HEIGHT),
                )
            }
        else ->
            items(waves, key = { it.key }) { wave ->
                WaveCard(wave, isActive = !showEnded, onClick = { onOpen(wave) })
            }
    }
}

@Composable
private fun WaveCard(
    wave: LocalCampaign,
    isActive: Boolean,
    onClick: () -> Unit,
) {
    val category = friendlyCategory(wave.category)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(SurfaceElevated)
                .clickable(onClick = onClick)
                .padding(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconTile(category.icon, if (isActive) Danger else SystemGray)
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    waveTitle(wave),
                    color = White,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = TextSize.Body,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    countAndAge(wave),
                    color = TextSecondary,
                    fontSize = TextSize.Footnote,
                    maxLines = 1,
                )
            }
            if (isActive) {
                Spacer(Modifier.width(8.dp))
                ActiveTag()
            }
        }
        Spacer(Modifier.height(10.dp))
        Text(
            SmsLinkSafety.hideLinks(wave.messages.first().body),
            color = TextSecondary,
            fontSize = TextSize.Footnote,
            lineHeight = 18.sp,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
internal fun IconTile(
    icon: ImageVector,
    tint: Color,
) {
    Box(
        Modifier.size(36.dp).background(tint.copy(alpha = 0.15f), RoundedCornerShape(10.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(20.dp))
    }
}

@Composable
private fun ActiveTag() {
    Box(
        Modifier
            .background(Danger.copy(alpha = 0.15f), RoundedCornerShape(6.dp))
            .padding(horizontal = 8.dp, vertical = 3.dp),
    ) {
        Text(
            stringResource(R.string.waves_tag_active),
            color = Danger,
            fontSize = TextSize.Caption,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun LoadingRows() {
    Column(modifier = Modifier.fillMaxWidth()) {
        repeat(LOADING_ROWS) {
            MessageRowSkeleton(avatarSize = 36.dp, horizontalPadding = 4.dp, verticalPadding = 12.dp)
        }
    }
}

internal fun waveTitle(wave: LocalCampaign): String =
    // An unnamed group is titled with its raw category; show the friendly one.
    if (wave.title == wave.category) friendlyCategory(wave.category).label else wave.title

@Composable
internal fun countAndAge(wave: LocalCampaign): String =
    pluralStringResource(R.plurals.campaigns_messages, wave.messages.size, wave.messages.size) +
        " · " +
        stringResource(R.string.waves_last_seen, MessageTime.listLabel(LocalContext.current, wave.latestTimestamp))

/**
 * Every name a published safety tip may use for this wave in its Campaign
 * field: the backend cluster id, the raw and friendly category, and the title.
 */
internal fun waveNames(wave: LocalCampaign): List<String> {
    val friendly = friendlyCategory(wave.category).label
    return listOfNotNull(wave.clusterId, wave.category, friendly, waveTitle(wave))
}

/** Still arriving: the newest text is under [ACTIVE_WINDOW_MS] old. */
internal fun LocalCampaign.isActive(now: Long): Boolean = now - latestTimestamp < ACTIVE_WINDOW_MS

// Same keyword rules as CampaignDetailScreen.campaignAdvice, over what this
// phone actually has: the texts and their links.
internal fun waveAdvice(
    wave: LocalCampaign,
    domains: List<String>,
): List<Int> {
    val evidence = (wave.messages.joinToString(" ") { it.body } + " " + wave.category).lowercase()
    val advice = mutableListOf<Int>()
    if (domains.isNotEmpty()) advice += R.string.campaign_advice_links
    if (listOf("gcash", "maya", "bank", "bdo", "bpi", "wallet", "otp", "pin").any { it in evidence }) {
        advice += R.string.campaign_advice_otp
    }
    if (listOf("job", "loan", "prize", "winner", "reward", "cash").any { it in evidence }) {
        advice += R.string.campaign_advice_fees
    }
    if (advice.isEmpty()) advice += R.string.campaign_advice_generic
    // At most two, most specific first: a long list read as boilerplate.
    return advice.distinct().take(MAX_ADVICE)
}

internal fun openTarget(
    target: OpenTarget,
    navController: NavController,
) {
    when (target) {
        is OpenTarget.Thread -> navController.navigate(Screen.Detail.createRoute(target.sender))
        is OpenTarget.Alert -> navController.navigate(Screen.SmishingAlert.createRoute(target.backendMessageId))
    }
}

internal data class FriendlyCategory(
    val label: String,
    val icon: ImageVector,
)

// The AI's category names ("Bank phishing", "OTP / account update") are
// analyst vocabulary; these say what the text pretends to be. Keyed by the
// names in LocalCampaigns.kt / ai/service/campaign_naming.py -- an unknown
// one shows as-is.
internal fun friendlyCategory(category: String): FriendlyCategory =
    when (category) {
        "Parcel / delivery scam" -> FriendlyCategory("Fake delivery texts", Icons.Outlined.LocalShipping)
        "Bank phishing" -> FriendlyCategory("Fake bank texts", Icons.Outlined.AccountBalance)
        "E-wallet phishing" -> FriendlyCategory("Fake GCash / Maya texts", Icons.Outlined.AccountBalanceWallet)
        "Loan / credit offer" -> FriendlyCategory("Loan offers", Icons.Outlined.Payments)
        "Online gambling / casino" -> FriendlyCategory("Gambling & casino", Icons.Outlined.Casino)
        "Rewards / prize claim" -> FriendlyCategory("Fake prizes & rewards", Icons.Outlined.CardGiftcard)
        "Job / task offer" -> FriendlyCategory("Job & task offers", Icons.Outlined.Work)
        "OTP / account update" -> FriendlyCategory("Requests for codes", Icons.Outlined.Key)
        "Government / ID request" -> FriendlyCategory("Fake government texts", Icons.Outlined.Badge)
        OTHER_SCAM_CATEGORY -> FriendlyCategory("Other scams", Icons.Outlined.WarningAmber)
        else -> FriendlyCategory(category, Icons.Outlined.WarningAmber)
    }

// Active while its newest text is under 30 days old. Nothing is stored: a new
// text for an inactive wave makes it recent again, so it moves back to Active
// and the 30 days restart from that text.
private const val ACTIVE_WINDOW_MS = 30L * 24 * 60 * 60 * 1000
private const val MAX_ADVICE = 2
private const val LOADING_ROWS = 3

// Empty/error states fill this much of the list's height and center in it,
// so they sit in the visible middle rather than behind the floating tab bar.
private const val EMPTY_STATE_HEIGHT = 0.8f
