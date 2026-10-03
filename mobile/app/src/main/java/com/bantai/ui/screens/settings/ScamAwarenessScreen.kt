package com.bantai.ui.screens.settings

import androidx.annotation.StringRes
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.animateFloatAsState
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.automirrored.filled.Help
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.data.remote.TipsApi
import com.bantai.navigation.Screen
import com.bantai.ui.components.LocalBottomBarClearance
import com.bantai.ui.theme.BantAIColors
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.BorderColor
import com.bantai.ui.theme.LocalBantAIColors
import com.bantai.ui.theme.Surface
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
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.action_back),
                    tint = White,
                )
            }
            Text(
                stringResource(R.string.scam_awareness_scam_awareness),
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = TextSize.Headline,
                modifier = Modifier.align(Alignment.Center),
            )
        }
        HorizontalDivider(color = Surface)

        // One category open at a time, kept across rotation and coming back
        // from a tip's detail page.
        var expanded by rememberSaveable { mutableStateOf<Int?>(null) }
        var expandedTip by rememberSaveable { mutableStateOf(openTipId) }
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            // Bottom clearance matches the floating tab bar's footprint (see
            // MainScreen) -- this screen now renders behind that persistent bar.
            contentPadding =
                PaddingValues(
                    start = 16.dp,
                    top = 16.dp,
                    end = 16.dp,
                    bottom = LocalBottomBarClearance.current,
                ),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            latestWarnings(latestTips, expandedTip) { id -> expandedTip = if (expandedTip == id) null else id }
            itemsIndexed(categories) { index, category ->
                CategoryCard(
                    category = category,
                    isExpanded = expanded == index,
                    relevantTipIds = relevantTipIds,
                    onToggle = { expanded = if (expanded == index) null else index },
                    onTipClick = { tip -> navController.navigate(Screen.SettingsTipDetail.createRoute(tip.tipId)) },
                )
            }
        }
    }
}

@Composable
private fun CategoryCard(
    category: TipCategory,
    isExpanded: Boolean,
    relevantTipIds: Set<String>,
    onToggle: () -> Unit,
    onTipClick: (TipEntry) -> Unit,
) {
    val tint = category.tintOf(LocalBantAIColors.current)
    val chevronRotation by animateFloatAsState(if (isExpanded) CHEVRON_OPEN_DEGREES else 0f, label = "chevron")
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(Surface)
                .animateContentSize(),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onToggle)
                    .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier.size(40.dp).background(tint.copy(alpha = 0.15f), RoundedCornerShape(10.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(category.icon, contentDescription = null, tint = tint, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                CategoryTitle(category, isRelevant = category.tips.any { it.tipId in relevantTipIds })
                Spacer(Modifier.height(2.dp))
                Text(stringResource(category.description), color = TextSecondary, fontSize = TextSize.Footnote)
            }
            Spacer(Modifier.width(8.dp))
            Icon(
                Icons.AutoMirrored.Filled.ArrowForwardIos,
                contentDescription = null,
                tint = TextTertiary,
                modifier = Modifier.size(14.dp).rotate(chevronRotation),
            )
        }
        if (isExpanded) {
            category.tips.forEach { tip ->
                HorizontalDivider(color = BorderColor, thickness = 0.5.dp, modifier = Modifier.padding(start = 68.dp))
                TipRow(tip, isRelevant = tip.tipId in relevantTipIds, onClick = { onTipClick(tip) })
            }
        }
    }
}

// The badge always sits on the title's line: the title takes what's left
// (weight, not fill, so a short title keeps the badge right beside it) and
// ellipsizes, while the badge never wraps or shrinks.
@Composable
private fun CategoryTitle(
    category: TipCategory,
    isRelevant: Boolean,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            stringResource(category.name),
            color = White,
            fontWeight = FontWeight.Bold,
            fontSize = TextSize.Subhead,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f, fill = false),
        )
        if (isRelevant) {
            Spacer(Modifier.width(6.dp))
            RelevantBadge()
        }
    }
}

// Indented under the category's title, so the tips read as its contents.
@Composable
private fun TipRow(
    tip: TipEntry,
    isRelevant: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(start = 68.dp, end = 16.dp, top = 14.dp, bottom = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Badge on the title's line, as in CategoryTitle; a long tip title
        // wraps to a second line beside it instead of pushing it down.
        Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
            Text(
                stringResource(tip.title),
                color = White,
                fontSize = TextSize.Subhead,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
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

private const val CHEVRON_OPEN_DEGREES = 90f

// The team's published tips above the built-in topics, each opening in place.
private fun LazyListScope.latestWarnings(
    latestTips: List<TipsApi.PublishedTip>,
    expandedTip: String?,
    onToggle: (String) -> Unit,
) {
    if (latestTips.isEmpty()) return
    item(key = "latest-header") {
        Text(
            stringResource(R.string.tips_latest_warnings),
            color = TextSecondary,
            fontSize = TextSize.Footnote,
            modifier = Modifier.padding(start = 4.dp),
        )
    }
    items(latestTips, key = { "latest-${it.id}" }) { tip ->
        PublishedTipCard(
            title = tip.title,
            body = tip.body,
            isExpanded = expandedTip == tip.id,
            onToggle = { onToggle(tip.id) },
        )
    }
    item(key = "builtin-header") {
        Text(
            stringResource(R.string.tips_by_topic),
            color = TextSecondary,
            fontSize = TextSize.Footnote,
            modifier = Modifier.padding(start = 4.dp, top = 6.dp),
        )
    }
}

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
                .clip(RoundedCornerShape(14.dp))
                .background(Surface)
                .clickable(onClick = onToggle)
                .animateContentSize()
                .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(40.dp).background(tint.copy(alpha = 0.15f), RoundedCornerShape(10.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.Campaign, contentDescription = null, tint = tint, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.width(12.dp))
            Text(
                title,
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = TextSize.Subhead,
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
            Spacer(Modifier.height(10.dp))
            Text(body, color = TextSecondary, fontSize = TextSize.Subhead, lineHeight = 20.sp)
        }
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
