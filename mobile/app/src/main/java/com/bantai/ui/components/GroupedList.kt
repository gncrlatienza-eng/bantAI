package com.bantai.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bantai.ui.theme.IosBlue
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize

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
