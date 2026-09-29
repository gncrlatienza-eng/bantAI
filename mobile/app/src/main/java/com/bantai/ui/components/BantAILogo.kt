package com.bantai.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.bantai.R

/**
 * The BantAI app icon, drawn in the app: ic_bantai_app_icon -- the indigo
 * gradient tile with the white bubble and indigo shield, at the home-screen
 * icon's proportions. Every in-app logo and the launch window use that one
 * drawable, so the logo looks identical everywhere, in light and dark mode.
 */
@Composable
fun BantAILogo(size: Dp = 80.dp) {
    Image(
        painter = painterResource(R.drawable.ic_bantai_app_icon),
        contentDescription = "BantAI",
        modifier = Modifier.size(size),
    )
}
