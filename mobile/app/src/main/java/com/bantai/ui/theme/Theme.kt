package com.bantai.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

val BantAIColorScheme = darkColorScheme(
    primary = Indigo,
    onPrimary = White,
    secondary = Indigo,
    onSecondary = White,
    tertiary = Safe,
    onTertiary = Black,
    background = Black,
    onBackground = White,
    surface = Surface,
    onSurface = White,
    surfaceVariant = SurfaceVariant,
    onSurfaceVariant = TextSecondary,
    error = Danger,
    onError = White,
    outline = BorderColor,
)

@Composable
fun BantAITheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = BantAIColorScheme,
        content = content,
    )
}
