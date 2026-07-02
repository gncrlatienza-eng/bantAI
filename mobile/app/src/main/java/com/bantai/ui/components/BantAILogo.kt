package com.bantai.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

@Composable
fun BantAILogo(
    containerSize: Dp = 80.dp,
    iconSize: Dp = 44.dp,
    backgroundColor: Color = Color(0xFF1A1A2E),
    iconColor: Color = Color(0xFF5B4FE8),
) {
    Box(
        modifier = Modifier
            .size(containerSize)
            .background(backgroundColor, RoundedCornerShape(20.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = Icons.Filled.Shield,
            contentDescription = "BantAI Shield",
            tint = iconColor,
            modifier = Modifier.size(iconSize),
        )
    }
}
