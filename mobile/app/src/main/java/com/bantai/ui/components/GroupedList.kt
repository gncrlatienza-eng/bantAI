package com.bantai.ui.components

import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.IosBlue
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White

/**
 * iOS "inset grouped" lists (Settings, Mail's mailbox list): rows sit in
 * rounded cards on the grouped page background, each card under a small
 * all-caps grey header. The Alerts and Campaigns tabs use this so they read
 * as calm as Settings instead of full-bleed rows with colored badges.
 *
 * A card is built from separate LazyColumn items (one per row, so long lists
 * stay lazy): [groupedItem] rounds only the first row's top corners and the
 * last row's bottom corners, so consecutive rows join into one card.
 */
private val CARD_RADIUS = 16.dp
private val PAGE_GUTTER = 16.dp

@Composable
fun Modifier.groupedItem(
    index: Int,
    lastIndex: Int,
): Modifier {
    val top = if (index == 0) CARD_RADIUS else 0.dp
    val bottom = if (index == lastIndex) CARD_RADIUS else 0.dp
    return this
        .padding(horizontal = PAGE_GUTTER)
        .clip(RoundedCornerShape(topStart = top, topEnd = top, bottomStart = bottom, bottomEnd = bottom))
        .background(SurfaceElevated)
}

/**
 * Small all-caps header above a card, with an optional right-aligned detail (a
 * count), or a right-aligned blue action when [onDetailClick] is set.
 */
@Composable
fun GroupedSectionHeader(
    title: String,
    detail: String? = null,
    onDetailClick: (() -> Unit)? = null,
) {
    Row(
        modifier = Modifier.padding(start = PAGE_GUTTER * 2, end = PAGE_GUTTER * 2, top = 22.dp, bottom = 6.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        Text(
            title.uppercase(),
            color = TextSecondary,
            fontSize = TextSize.Caption,
            letterSpacing = 0.4.sp,
            modifier = Modifier.weight(1f),
        )
        detail?.let {
            if (onDetailClick == null) {
                Text(it, color = TextSecondary, fontSize = TextSize.Caption)
            } else {
                Text(
                    it,
                    color = IosBlue,
                    fontSize = TextSize.Footnote,
                    modifier = Modifier.clickable(onClick = onDetailClick).padding(start = 12.dp, top = 4.dp),
                )
            }
        }
    }
}

/** Grey caption under a card or list, for notes that shouldn't compete with rows. */
@Composable
fun GroupedFooter(text: String) {
    Text(
        text,
        color = TextSecondary,
        fontSize = TextSize.Footnote,
        modifier = Modifier.padding(start = PAGE_GUTTER * 2, end = PAGE_GUTTER * 2, top = 8.dp),
    )
}

/** iOS Settings-style icon: a small solid rounded tile with a white glyph. */
@Composable
fun IconTile(
    icon: ImageVector,
    tint: Color,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier.size(30.dp).background(tint, RoundedCornerShape(8.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
    }
}

/** Hairline between rows of one card, starting past the icon tile like iOS. */
@Composable
fun GroupedRowDivider() {
    HorizontalDivider(color = Hairline, thickness = 0.5.dp, modifier = Modifier.padding(start = GROUPED_ROW_INDENT))
}

// Rows' text (and the divider) starts past the icon tile.
val GROUPED_ROW_INDENT = 56.dp

/**
 * A row of an inset grouped card: icon tile, title, an optional one-line
 * [summary], and a chevron. With [expandedContent] the row opens in place (the
 * chevron turns down) -- the Privacy & data pattern: short at a glance, the
 * full wording one tap away. Without it, [onClick] acts like a link row.
 */
@Composable
@Suppress("LongParameterList") // one row's look plus its two behaviors
fun GroupedRow(
    icon: ImageVector,
    tint: Color,
    title: String,
    modifier: Modifier = Modifier,
    summary: String? = null,
    expanded: Boolean = false,
    onClick: () -> Unit = {},
    expandedContent: (@Composable ColumnScope.() -> Unit)? = null,
) {
    val rotation by animateFloatAsState(
        if (expanded && expandedContent != null) CHEVRON_OPEN_DEGREES else 0f,
        label = "chevron",
    )
    Column(modifier.fillMaxWidth().animateContentSize()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onClick)
                    .padding(horizontal = 14.dp, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconTile(icon, tint)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(title, color = White, fontSize = TextSize.Body)
                summary?.let {
                    Text(it, color = TextSecondary, fontSize = TextSize.Caption, lineHeight = 16.sp)
                }
            }
            Spacer(Modifier.width(8.dp))
            Icon(
                Icons.AutoMirrored.Filled.ArrowForwardIos,
                contentDescription = null,
                tint = TextTertiary,
                modifier = Modifier.size(13.dp).rotate(rotation),
            )
        }
        if (expanded && expandedContent != null) {
            Column(
                modifier = Modifier.padding(start = GROUPED_ROW_INDENT, end = 16.dp, bottom = 14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                content = expandedContent,
            )
        }
    }
}

private const val CHEVRON_OPEN_DEGREES = 90f
