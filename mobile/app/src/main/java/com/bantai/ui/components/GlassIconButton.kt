package com.bantai.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.bantai.ui.theme.White

/**
 * The round translucent button in the Messages/Alerts title rows. The circle
 * stays 38dp to match the iOS look, but it sits in a 48dp IconButton so the
 * touch target meets Android's minimum and a press shows a ripple (it used
 * to be a bare 38dp clickable with the indication turned off).
 */
@Composable
fun GlassIconButton(
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    IconButton(onClick = onClick, modifier = modifier.size(48.dp)) {
        Box(
            modifier =
                Modifier
                    .size(38.dp)
                    .background(White.copy(alpha = 0.08f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                icon,
                contentDescription = contentDescription,
                tint = White,
                modifier = Modifier.size(18.dp),
            )
        }
    }
}
