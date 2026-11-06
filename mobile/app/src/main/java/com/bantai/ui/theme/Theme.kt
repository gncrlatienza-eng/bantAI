package com.bantai.ui.theme

import android.content.res.Configuration
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density

private fun materialScheme(colors: BantAIColors): ColorScheme {
    val base = if (colors.isDark) darkColorScheme() else lightColorScheme()
    return base.copy(
        primary = colors.indigo,
        onPrimary = colors.onIndigo,
        secondary = colors.indigo,
        onSecondary = colors.onIndigo,
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

// The phone widths the layout is designed for. Android's "Display size" /
// Samsung's "Screen zoom" and different screens put phones anywhere from about
// 320dp to 480dp wide, so the same screen looked cramped (text wrapping, rows
// clipping) on one phone and small and sparse on another. Within this band a
// phone keeps its own size; outside it, the whole UI is scaled so the screen
// reads as the nearest edge of the band.
private const val MIN_LAYOUT_WIDTH_DP = 360f
private const val MAX_LAYOUT_WIDTH_DP = 400f

// Tablets and unfolded foldables have room to spare; they're left alone.
private const val TABLET_MIN_WIDTH_DP = 600

// Phone font size x the in-app Text size together. Past this, one-line rows
// (the tab bar, the search pill, list rows) start clipping their text.
private const val MAX_FONT_SCALE = 1.35f

/**
 * [base] with its dp size normalized to the layout band above (by the phone's
 * shortest side, so rotating doesn't change it) and its font scale set to the
 * phone's font size x [textScale], capped at [MAX_FONT_SCALE]. Every size in
 * the app is in dp/sp, so this one override resizes all of it at once.
 */
private fun normalizedDensity(
    base: Density,
    configuration: Configuration,
    textScale: Float,
): Density {
    val shortSideDp = configuration.smallestScreenWidthDp
    val density =
        if (shortSideDp <= 0 || shortSideDp >= TABLET_MIN_WIDTH_DP) {
            base.density
        } else {
            val target = shortSideDp.toFloat().coerceIn(MIN_LAYOUT_WIDTH_DP, MAX_LAYOUT_WIDTH_DP)
            base.density * shortSideDp / target
        }
    val fontScale = (base.fontScale * textScale).coerceAtMost(MAX_FONT_SCALE)
    return Density(density, fontScale)
}

@Composable
fun BantAITheme(
    darkTheme: Boolean = true,
    textScale: Float = 1f,
    content: @Composable () -> Unit,
) {
    val colors = if (darkTheme) DarkColors else LightColors
    val scaledDensity = normalizedDensity(LocalDensity.current, LocalConfiguration.current, textScale)
    CompositionLocalProvider(LocalBantAIColors provides colors, LocalDensity provides scaledDensity) {
        MaterialTheme(
            colorScheme = materialScheme(colors),
            content = content,
        )
    }
}
