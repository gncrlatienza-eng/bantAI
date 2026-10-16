package com.bantai.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.bantai.R
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.OnIndigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.TextSecondary

/**
 * The round send arrow, iMessage-style: sits at the bottom right next to the
 * message field, filled with the accent once there's something to send.
 */
@Composable
fun SendButton(
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    size: Dp = 48.dp,
    // Optional: still tappable while dimmed, e.g. to explain what's missing.
    onDisabledClick: (() -> Unit)? = null,
) {
    Box(
        modifier =
            modifier
                .size(size)
                .clip(CircleShape)
                .background(if (enabled) Indigo else Surface)
                .clickable(
                    enabled = enabled || onDisabledClick != null,
                    onClick = if (enabled) onClick else onDisabledClick ?: {},
                ),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            Icons.Filled.ArrowUpward,
            contentDescription = stringResource(R.string.action_send),
            tint = if (enabled) OnIndigo else TextSecondary,
            modifier = Modifier.size(size * ICON_FRACTION),
        )
    }
}

// The arrow fills half the circle, like iMessage's.
private const val ICON_FRACTION = 0.5f
