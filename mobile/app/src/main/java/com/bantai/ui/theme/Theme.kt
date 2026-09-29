package com.bantai.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider

private fun materialScheme(colors: BantAIColors): ColorScheme {
    val base = if (colors.isDark) darkColorScheme() else lightColorScheme()
    return base.copy(
        primary = colors.indigo,
        onPrimary = OnAccent,
        secondary = colors.indigo,
        onSecondary = OnAccent,
        tertiary = colors.safe,
        onTertiary = colors.background,
        background = colors.background,
        onBackground = colors.label,
        surface = colors.surface,
        onSurface = colors.label,
        surfaceVariant = colors.surfaceVariant,
        onSurfaceVariant = colors.textSecondary,
        surfaceContainer = colors.surfaceElevated,
        surfaceContainerHigh = colors.surfaceElevated,
        surfaceContainerHighest = colors.surfaceVariant,
        error = colors.danger,
        onError = OnAccent,
        outline = colors.border,
        outlineVariant = colors.hairline,
    )
}

@Composable
fun BantAITheme(
    darkTheme: Boolean = true,
    content: @Composable () -> Unit,
) {
    val colors = if (darkTheme) DarkColors else LightColors
    CompositionLocalProvider(LocalBantAIColors provides colors) {
        MaterialTheme(
            colorScheme = materialScheme(colors),
            content = content,
        )
    }
}
