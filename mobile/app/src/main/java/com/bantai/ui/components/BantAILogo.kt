package com.bantai.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.bantai.R
import com.bantai.ui.theme.DarkIndigo

@Composable
fun BantAILogo(
    containerSize: Dp = 80.dp,
    iconSize: Dp = 44.dp,
    backgroundColor: Color = DarkIndigo,
) {
    Box(
        modifier =
            Modifier
                .size(containerSize)
                .background(backgroundColor, RoundedCornerShape(20.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Image(
            painter = painterResource(R.drawable.ic_bantai_logo),
            contentDescription = "BantAI",
            modifier = Modifier.size(iconSize),
        )
    }
}
