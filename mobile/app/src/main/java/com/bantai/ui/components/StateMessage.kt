package com.bantai.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.OnAccent
import com.bantai.ui.theme.OnIndigo
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White

/**
 * The one layout for an empty, error or permission state: icon, title, a
 * sentence of detail, and optionally the button that gets the user out of it
 * (Retry, Allow access). Errors used to be a line of red text with no way
 * forward, and empty lists a single faint word.
 */
@Composable
@Suppress("LongParameterList")
fun StateMessage(
    icon: ImageVector,
    title: String,
    modifier: Modifier = Modifier,
    detail: String? = null,
    iconTint: Color = TextSecondary,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Column(
        modifier = modifier.fillMaxWidth().padding(horizontal = 40.dp, vertical = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(40.dp))
        Spacer(Modifier.height(12.dp))
        Text(
            title,
            color = White,
            fontWeight = FontWeight.SemiBold,
            fontSize = TextSize.Headline,
            textAlign = TextAlign.Center,
        )
        if (!detail.isNullOrBlank()) {
            Spacer(Modifier.height(4.dp))
            Text(detail, color = TextSecondary, fontSize = TextSize.Subhead, textAlign = TextAlign.Center)
        }
        if (actionLabel != null && onAction != null) {
            Spacer(Modifier.height(16.dp))
            TextButton(onClick = onAction) {
                Text(actionLabel, color = Indigo, fontWeight = FontWeight.SemiBold, fontSize = TextSize.Body)
            }
        }
    }
}

/** Full-width filled button, the primary action on a detail screen. */
@Composable
fun PrimaryButton(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = Indigo,
    onClick: () -> Unit,
) {
    TextButton(
        onClick = onClick,
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(min = 50.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(color),
    ) {
        // Text follows the fill: the accent's own on-color, else white (red, green buttons).
        val textColor = if (color == Indigo) OnIndigo else OnAccent
        Text(text, color = textColor, fontWeight = FontWeight.SemiBold, fontSize = TextSize.Body)
    }
}

/** Full-width tinted button for the second choice under a [PrimaryButton]. */
@Composable
fun SecondaryButton(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = Indigo,
    onClick: () -> Unit,
) {
    Box(modifier.fillMaxWidth()) {
        TextButton(
            onClick = onClick,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 50.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(color.copy(alpha = 0.14f)),
        ) {
            Text(text, color = color, fontWeight = FontWeight.SemiBold, fontSize = TextSize.Body)
        }
    }
}
