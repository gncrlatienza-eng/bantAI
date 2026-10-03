@file:Suppress("MatchingDeclarationName") // named for its main composable, ThreadVerdictCard

package com.bantai.ui.screens.main.thread

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bantai.R
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.IosBlue
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White

/** One tappable word in a [ThreadVerdictCard]'s action row. */
internal data class VerdictAction(
    val label: String,
    val color: Color,
    val onClick: () -> Unit,
)

/**
 * The card under a thread's header whenever BantAI has something to say about
 * it -- a likely scam, an Unknown verdict, or a spoof sign on a trusted name
 * (BDO, GCash). One look for all three, styled like an iOS inset card: a quiet
 * grey surface, a small tinted glyph with a short [headline], and a row of
 * plain tinted text actions split by hairlines. The longer explanation
 * ([detail]) folds away behind "Why?", so the card is the same size for every
 * sender until the user asks for more.
 */
@Composable
internal fun ThreadVerdictCard(
    headline: String,
    tint: Color,
    actions: List<VerdictAction>,
    detail: String? = null,
    busy: Boolean = false,
) {
    var expanded by rememberSaveable(detail) { mutableStateOf(false) }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Surface)
                .animateContentSize(),
    ) {
        Row(
            modifier = Modifier.padding(start = 14.dp, end = 10.dp, top = 10.dp, bottom = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Icon(Icons.Outlined.WarningAmber, contentDescription = null, tint = tint, modifier = Modifier.size(16.dp))
            Text(
                headline,
                color = White,
                fontSize = TextSize.Footnote,
                fontWeight = FontWeight.Medium,
                // Wraps rather than cutting a long sender name off with "...".
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            if (busy) {
                CircularProgressIndicator(color = TextSecondary, strokeWidth = 2.dp, modifier = Modifier.size(14.dp))
            } else if (detail != null) {
                Text(
                    stringResource(if (expanded) R.string.thread_banner_hide else R.string.thread_banner_why),
                    color = IosBlue,
                    fontSize = TextSize.Footnote,
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .clickable { expanded = !expanded }
                            .padding(horizontal = 4.dp, vertical = 2.dp),
                )
            }
        }
        if (expanded && detail != null) {
            Text(
                detail,
                color = TextSecondary,
                fontSize = TextSize.Footnote,
                lineHeight = 18.sp,
                modifier = Modifier.padding(start = 40.dp, end = 14.dp, bottom = 12.dp),
            )
        }
        HorizontalDivider(color = Hairline, thickness = 0.5.dp)
        Row(Modifier.height(IntrinsicSize.Min).alpha(if (busy) DISABLED_ALPHA else 1f)) {
            actions.forEachIndexed { index, action ->
                if (index > 0) VerticalDivider(color = Hairline, thickness = 0.5.dp)
                VerdictActionCell(action, enabled = !busy)
            }
        }
    }
}

/**
 * The Unknown verdict asks the user, since the model wasn't sure: a real
 * message goes to Messages, spam to Spam (both filed as a report so the AI
 * learns from it), and a scam goes through Take Action. Also for a trusted
 * name (Globe, BDO): none of the three blocks anyone, and the Unknown chip
 * lists them too, so they need the same way out.
 */
@Composable
@Suppress("LongParameterList") // the card's text, then one callback per answer
internal fun UnknownVerdictBanner(
    headline: String,
    detail: String,
    busy: Boolean,
    onRealMessage: () -> Unit,
    onSpam: () -> Unit,
    onReportScam: () -> Unit,
) {
    ThreadVerdictCard(
        headline = if (busy) stringResource(R.string.thread_flag_sending) else headline,
        detail = detail,
        tint = Suspicious,
        busy = busy,
        actions =
            listOf(
                VerdictAction(stringResource(R.string.thread_flag_real), IosBlue, onRealMessage),
                VerdictAction(stringResource(R.string.thread_flag_spam), IosBlue, onSpam),
                VerdictAction(stringResource(R.string.thread_flag_report_scam), Danger, onReportScam),
            ),
    )
}

private const val DISABLED_ALPHA = 0.4f

// One cell of the action row: plain tinted text, the whole cell is the touch target.
@Composable
private fun RowScope.VerdictActionCell(
    action: VerdictAction,
    enabled: Boolean,
) {
    Box(
        modifier =
            Modifier
                .weight(1f)
                .heightIn(min = 44.dp)
                .clickable(enabled = enabled, onClick = action.onClick)
                .padding(horizontal = 6.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            action.label,
            color = action.color,
            fontSize = TextSize.Subhead,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.Center,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
