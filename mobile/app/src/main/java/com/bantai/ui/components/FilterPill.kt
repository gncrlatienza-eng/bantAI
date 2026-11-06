package com.bantai.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.bantai.ui.theme.BantaiShapes
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.IosBlue
import com.bantai.ui.theme.OnIndigo
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White

private const val SELECTED_COUNT_ALPHA = 0.75f

/**
 * One filter pill, shared by Messages (All / Spam / Unknown...) and Alerts
 * (To review / Reported / Blocked) so both rows look the same: indigo when
 * chosen, grey otherwise. [hasNew] adds a blue dot; [count] a quiet number.
 * [modifier] is applied to the whole pill (a walkthrough spotlight included).
 */
@Composable
@Suppress("LongParameterList") // label, state, then the optional dot / count
fun FilterPill(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    hasNew: Boolean = false,
    count: Int? = null,
    description: String = label,
) {
    Row(
        modifier =
            modifier
                .heightIn(min = 36.dp)
                .clip(BantaiShapes.Pill)
                .background(if (selected) Indigo else SurfaceElevated)
                .clickable(onClick = onClick)
                .padding(horizontal = 14.dp, vertical = 8.dp)
                .semantics { contentDescription = description },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (hasNew) {
            Box(Modifier.size(7.dp).background(if (selected) OnIndigo else IosBlue, CircleShape))
            Spacer(Modifier.width(6.dp))
        }
        Text(
            label,
            color = if (selected) OnIndigo else White,
            fontSize = TextSize.Subhead,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
        )
        if (count != null) {
            Spacer(Modifier.width(6.dp))
            Text(
                count.toString(),
                color = if (selected) OnIndigo.copy(alpha = SELECTED_COUNT_ALPHA) else TextSecondary,
                fontSize = TextSize.Footnote,
            )
        }
    }
}
