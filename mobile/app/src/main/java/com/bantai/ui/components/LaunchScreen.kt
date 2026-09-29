package com.bantai.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.colorResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bantai.R

private const val NAME_FADE_MS = 300

/**
 * Shown while the app works out its first screen (theme choice, signed-in
 * state). It repeats the launch window (res/drawable/launch_background.xml)
 * exactly -- plain black, the app icon centred -- so swapping from that window
 * to this screen is invisible; then the app name fades in below the icon (a
 * window drawable can't draw text, so it only appears once the app is drawing).
 *
 * The name is set like an iOS launch screen: a plain sans-serif at a medium
 * weight with slightly tight tracking -- quiet, not a heavy headline.
 */
@Composable
fun LaunchScreen() {
    var showName by remember { mutableStateOf(false) }
    val nameAlpha by animateFloatAsState(if (showName) 1f else 0f, tween(NAME_FADE_MS), label = "launchName")
    LaunchedEffect(Unit) { showName = true }

    Box(
        modifier = Modifier.fillMaxSize().background(colorResource(R.color.background)),
        contentAlignment = Alignment.Center,
    ) {
        BantAILogo(size = 80.dp)
        // Offset from the centre rather than stacked in a Column, so the icon
        // stays exactly where the launch window drew it.
        Text(
            "BantAI",
            color = Color.White,
            fontFamily = FontFamily.SansSerif,
            fontSize = 22.sp,
            fontWeight = FontWeight.Medium,
            letterSpacing = (-0.2).sp,
            modifier = Modifier.offset(y = 70.dp).alpha(nameAlpha),
        )
    }
}
