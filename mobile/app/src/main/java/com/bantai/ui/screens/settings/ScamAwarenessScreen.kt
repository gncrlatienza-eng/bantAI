package com.bantai.ui.screens.settings

import androidx.annotation.StringRes
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.automirrored.filled.Help
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.data.remote.TipsApi
import com.bantai.navigation.Screen
import com.bantai.ui.components.GroupedRow
import com.bantai.ui.components.GroupedRowDivider
import com.bantai.ui.components.GroupedSectionHeader
import com.bantai.ui.components.IconTile
import com.bantai.ui.components.IosTopBar
import com.bantai.ui.components.LocalBottomBarClearance
import com.bantai.ui.components.groupedItem
import com.bantai.ui.theme.BantAIColors
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.LocalBantAIColors
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.SuspiciousText
import com.bantai.ui.theme.SystemGray
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White
import com.bantai.viewmodel.ScamAwarenessViewModel

private data class TipEntry(
    val tipId: String,
    @StringRes val title: Int,
)

/** A category card; tapping it opens its [tips] in place. */
private data class TipCategory(
    @StringRes val name: Int,
    @StringRes val description: Int,
    val icon: ImageVector,
    // Picks the tint from the current theme's palette (tints differ in light/dark).
    val tintOf: (BantAIColors) -> Color,
    val tips: List<TipEntry>,
)

// Categories first, tips on tap: the old flat list showed every tip at once,
// which read as a wall of cards with no way to find the one you wanted.
private val categories =
    listOf(
        TipCategory(
            R.string.tips_cat_finance,
            R.string.tips_cat_finance_desc,
            Icons.Filled.Shield,
            { it.danger },
            listOf(TipEntry("gcash", R.string.tips_gcash_title), TipEntry("otp", R.string.tips_otp_title)),
        ),
        TipCategory(
            R.string.tips_cat_psychology,
            R.string.tips_cat_psychology_desc,
            Icons.Filled.Bolt,
            { it.suspicious },
            listOf(TipEntry("urgency", R.string.tips_urgency_title)),
        ),
        TipCategory(
            R.string.tips_cat_technical,
            R.string.tips_cat_technical_desc,
            Icons.Filled.Link,
            { it.indigo },
            listOf(TipEntry("links", R.string.tips_links_title)),
        ),
        TipCategory(
            R.string.tips_cat_action,
            R.string.tips_cat_action_desc,
            Icons.AutoMirrored.Filled.Help,
            { SystemGray },
            listOf(TipEntry("action", R.string.tips_action_title)),
        ),
        TipCategory(
            R.string.tips_cat_ai,
            R.string.tips_cat_ai_desc,
            Icons.Filled.Psychology,
            { it.indigo },
            listOf(TipEntry("shap", R.string.tips_shap_title)),
        ),
    )

@Composable
fun ScamAwarenessScreen(
    navController: NavController,
    /** Tip to show opened, e.g. from its notification. */
    openTipId: String? = null,
    viewModel: ScamAwarenessViewModel = viewModel(),
) {
    val relevantTipIds by viewModel.relevantTipIds.collectAsState()
    val latestTips by viewModel.latestTips.collectAsState()

    Column(modifier = Modifier.fillMaxSize().background(Black)) {
        IosTopBar(
            title = stringResource(R.string.scam_awareness_scam_awareness),
            onBack = { navController.popBackStack() },
        )

        // One topic and one warning open at a time, kept across rotation and
        // coming back from a tip's page. Same grouped pattern as Privacy & data:
        // a line per topic at a glance, its tips one tap away.
        var expanded by rememberSaveable { mutableStateOf<Int?>(null) }
        var expandedTip by rememberSaveable { mutableStateOf(openTipId) }
        val colors = LocalBantAIColors.current
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            // Bottom clearance matches the floating tab bar's footprint (see
            // MainScreen) -- this screen now renders behind that persistent bar.
            contentPadding = PaddingValues(bottom = LocalBottomBarClearance.current),
        ) {
            item(key = "hero") { AwarenessHero() }
            latestTipRows(latestTips, expandedTip) { id -> expandedTip = if (expandedTip == id) null else id }
            item(key = "builtin-header") { GroupedSectionHeader(stringResource(R.string.tips_by_topic)) }
            itemsIndexed(categories) { index, category ->
                val relevant = category.tips.any { it.tipId in relevantTipIds }
                Column(Modifier.groupedItem(index, categories.lastIndex)) {
                    GroupedRow(
                        icon = category.icon,
                        tint = category.tintOf(colors),
                        title = stringResource(category.name),
                        summary =
                            if (relevant) {
                                stringResource(R.string.scam_awareness_relevant_to_you)
                            } else {
                                stringResource(category.description)
                            },
                        expanded = expanded == index,
                        onClick = { expanded = if (expanded == index) null else index },
                        expandedContent = {
                            category.tips.forEach { tip ->
                                TopicTip(
                                    tip = tip,
                                    isRelevant = tip.tipId in relevantTipIds,
                                    onClick = {
                                        navController.navigate(Screen.SettingsTipDetail.createRoute(tip.tipId))
                                    },
                                )
                            }
                        },
                    )
                    if (index != categories.lastIndex) GroupedRowDivider()
                }
            }
        }
    }
}

private const val CHEVRON_OPEN_DEGREES = 90f
private val CARD_SHAPE = RoundedCornerShape(16.dp)

// Tip rows line up with the category title, past the icon tile.
private val TIP_INDENT = 56.dp

/**
 * A tip the BantAI team published from the admin dashboard. Opens in place,
 * like a category: the title first, the full text on tap.
 */
@Composable
internal fun PublishedTipCard(
    title: String,
    body: String,
    isExpanded: Boolean,
    onToggle: () -> Unit,
) {
    val tint = LocalBantAIColors.current.suspicious
    val chevronRotation by animateFloatAsState(if (isExpanded) CHEVRON_OPEN_DEGREES else 0f, label = "chevron")
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(CARD_SHAPE)
                .background(SurfaceElevated)
                .clickable(onClick = onToggle)
                .animateContentSize()
                .padding(horizontal = 14.dp, vertical = 12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconTile(Icons.Filled.Campaign, tint)
            Spacer(Modifier.width(12.dp))
            Text(
                title,
                color = White,
                fontWeight = FontWeight.Medium,
                fontSize = TextSize.Body,
                maxLines = if (isExpanded) Int.MAX_VALUE else 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.width(8.dp))
            Icon(
                Icons.AutoMirrored.Filled.ArrowForwardIos,
                contentDescription = null,
                tint = TextTertiary,
                modifier = Modifier.size(14.dp).rotate(chevronRotation),
            )
        }
        if (isExpanded && body.isNotBlank()) {
            Spacer(Modifier.height(8.dp))
            Text(
                body,
                color = TextSecondary,
                fontSize = TextSize.Footnote,
                lineHeight = 19.sp,
                modifier = Modifier.padding(start = TIP_INDENT - 14.dp),
            )
        }
    }
}

// The team's published warnings, each opening in place.
private fun LazyListScope.latestTipRows(
    latestTips: List<TipsApi.PublishedTip>,
    expandedTip: String?,
    onToggle: (String) -> Unit,
) {
    if (latestTips.isEmpty()) return
    item(key = "latest-header") { GroupedSectionHeader(stringResource(R.string.tips_latest_warnings)) }
    itemsIndexed(latestTips, key = { _, tip -> "latest-${tip.id}" }) { index, tip ->
        Column(Modifier.groupedItem(index, latestTips.lastIndex)) {
            GroupedRow(
                icon = Icons.Filled.Campaign,
                tint = LocalBantAIColors.current.suspicious,
                title = tip.title,
                expanded = expandedTip == tip.id,
                onClick = { onToggle(tip.id) },
                expandedContent =
                    tip.body.takeIf { it.isNotBlank() }?.let { body ->
                        {
                            Text(
                                body,
                                color = TextSecondary,
                                fontSize = TextSize.Footnote,
                                lineHeight = 19.sp,
                            )
                        }
                    },
            )
            if (index != latestTips.lastIndex) GroupedRowDivider()
        }
    }
}

@Composable
private fun AwarenessHero() {
    Column(
        modifier = Modifier.fillMaxWidth().padding(start = 32.dp, end = 32.dp, top = 12.dp, bottom = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier.size(56.dp).background(Indigo, RoundedCornerShape(14.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.Shield, contentDescription = null, tint = Color.White, modifier = Modifier.size(30.dp))
        }
        Spacer(Modifier.height(12.dp))
        Text(
            stringResource(R.string.tips_hero),
            color = TextSecondary,
            fontSize = TextSize.Footnote,
            lineHeight = 18.sp,
            textAlign = TextAlign.Center,
        )
    }
}

// One tip inside an open topic: its title, a "relevant" badge when it matches
// texts this phone received, and a chevron to its page.
@Composable
private fun TopicTip(
    tip: TipEntry,
    isRelevant: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // The title and badge share all the room left of the chevron. (A second
        // weighted spacer here used to cap the title at half the row, so tips
        // wrapped into a narrow column.)
        Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
            Text(
                stringResource(tip.title),
                color = Indigo,
                fontSize = TextSize.Subhead,
                lineHeight = 19.sp,
                modifier = Modifier.weight(1f, fill = false),
            )
            if (isRelevant) {
                Spacer(Modifier.width(6.dp))
                RelevantBadge()
            }
        }
        Spacer(Modifier.width(8.dp))
        Icon(
            Icons.AutoMirrored.Filled.ArrowForwardIos,
            contentDescription = null,
            tint = TextTertiary,
            modifier = Modifier.size(12.dp),
        )
    }
}

@Composable
private fun RelevantBadge(modifier: Modifier = Modifier) {
    Box(
        modifier =
            modifier
                .background(Suspicious.copy(alpha = 0.15f), RoundedCornerShape(4.dp))
                .padding(horizontal = 5.dp, vertical = 1.dp),
    ) {
        Text(
            stringResource(R.string.scam_awareness_relevant_to_you),
            color = SuspiciousText,
            fontSize = TextSize.Caption2,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            softWrap = false,
        )
    }
}
