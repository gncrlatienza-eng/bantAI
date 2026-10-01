package com.bantai.ui.screens.main.thread

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White

/**
 * The tinted banner under a thread's header: scam/suspicious verdicts, or a
 * spoof sign on a trusted sender. Tapping it opens Take Action.
 */
@Composable
internal fun ThreadWarningBanner(
    text: String,
    actionLabel: String,
    tint: Color,
    actionColor: Color,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
                .background(tint.copy(alpha = 0.12f), RoundedCornerShape(12.dp))
                .clickable(onClick = onClick)
                .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(Icons.Outlined.WarningAmber, contentDescription = null, tint = tint, modifier = Modifier.size(18.dp))
        Text(text, color = White, fontSize = TextSize.Subhead, modifier = Modifier.weight(1f))
        Text(actionLabel, color = actionColor, fontSize = TextSize.Subhead, fontWeight = FontWeight.SemiBold)
    }
}
