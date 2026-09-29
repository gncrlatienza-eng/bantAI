@file:Suppress("MagicNumber") // a palette is hex literals by nature

package com.bantai.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

// Avatar fills -- identity colors, the same in both themes.
val AvatarTeal = Color(0xFF00BCD4)
val AvatarRed = Color(0xFFFF4444)
val AvatarPink = Color(0xFFE91E8C)
val AvatarGreen = Color(0xFF4CAF50)
val AvatarPurple = Color(0xFF9C27B0)

// iOS systemGray -- identical in light and dark.
val SystemGray = Color(0xFF8E8E93)

// Text/icons drawn on top of an accent fill (a filled button, an outgoing
// bubble, an avatar) -- stays white in both themes, unlike [White] below.
val OnAccent = Color(0xFFFFFFFF)

/**
 * The app's colors, modeled on iOS's semantic colors (UIKit's label,
 * secondaryLabel, separator, systemGroupedBackground... and the system
 * tints), each with a light and a dark value:
 *
 * - Text is a hierarchy, not a set of grays: the primary label is pure black
 *   (light) / pure white (dark), and secondary/tertiary labels are that same
 *   ink at 60% / 30% opacity, so they sit correctly on any background.
 * - Light mode is "grouped": an off-white page with white cards on top.
 *   Dark mode is a true black page with dark-gray cards.
 * - Tints (red, green, orange, blue, the indigo brand color) get slightly
 *   brighter, less saturated variants in dark mode so they don't glare.
 *
 * The app was dark-only first, so two token names still read as the dark
 * values: [Black] is the page background and [White] is the primary label.
 */
@Immutable
data class BantAIColors(
    val isDark: Boolean,
    val background: Color,
    val label: Color,
    val surface: Color,
    val surfaceElevated: Color,
    val surfaceVariant: Color,
    val hairline: Color,
    val border: Color,
    val textSecondary: Color,
    val textTertiary: Color,
    val indigo: Color,
    val danger: Color,
    val safe: Color,
    val suspicious: Color,
    val iosBlue: Color,
    val darkIndigo: Color,
    val protectionSurface: Color,
    val contactBadge: Color,
    val glassFill: Color,
    val glassStroke: Color,
)

val DarkColors =
    BantAIColors(
        isDark = true,
        // systemGroupedBackground / secondarySystemGroupedBackground / systemGray5
        background = Color(0xFF000000),
        label = Color(0xFFFFFFFF),
        surface = Color(0xFF1C1C1E),
        surfaceElevated = Color(0xFF1C1C1E),
        surfaceVariant = Color(0xFF2C2C2E),
        // separator (60% of #545458) / opaqueSeparator
        hairline = Color(0x99545458),
        border = Color(0xFF38383A),
        // secondaryLabel / tertiaryLabel: #EBEBF5 at 60% / 30%
        textSecondary = Color(0x99EBEBF5),
        textTertiary = Color(0x4DEBEBF5),
        indigo = Color(0xFF6E63F0),
        danger = Color(0xFFFF453A),
        safe = Color(0xFF30D158),
        suspicious = Color(0xFFFF9F0A),
        iosBlue = Color(0xFF0A84FF),
        darkIndigo = Color(0xFF1A1A2E),
        protectionSurface = Color(0xFF0D1F0D),
        contactBadge = Color(0xFF3A3A5C),
        // Translucent "glass" material for the floating tab bar.
        glassFill = Color(0xE61C1C1E),
        glassStroke = Color(0x21FFFFFF),
    )

val LightColors =
    BantAIColors(
        isDark = false,
        // systemGroupedBackground / secondarySystemGroupedBackground / systemGray5
        background = Color(0xFFF2F2F7),
        label = Color(0xFF000000),
        surface = Color(0xFFFFFFFF),
        surfaceElevated = Color(0xFFFFFFFF),
        surfaceVariant = Color(0xFFE5E5EA),
        // separator (29% of #3C3C43) / opaqueSeparator
        hairline = Color(0x4A3C3C43),
        border = Color(0xFFC6C6C8),
        // secondaryLabel / tertiaryLabel: #3C3C43 at 60% / 30%
        textSecondary = Color(0x993C3C43),
        textTertiary = Color(0x4D3C3C43),
        indigo = Color(0xFF5B4FE8),
        danger = Color(0xFFFF3B30),
        safe = Color(0xFF34C759),
        suspicious = Color(0xFFFF9500),
        iosBlue = Color(0xFF007AFF),
        darkIndigo = Color(0xFFECEBFD),
        protectionSurface = Color(0xFFE8F7EC),
        contactBadge = Color(0xFFE5E5EA),
        glassFill = Color(0xEBFFFFFF),
        glassStroke = Color(0x14000000),
    )

val LocalBantAIColors = staticCompositionLocalOf { DarkColors }

val Black: Color
    @Composable @ReadOnlyComposable
    get() = LocalBantAIColors.current.background
val White: Color
    @Composable @ReadOnlyComposable
    get() = LocalBantAIColors.current.label
val Surface: Color
    @Composable @ReadOnlyComposable
    get() = LocalBantAIColors.current.surface
val SurfaceElevated: Color
    @Composable @ReadOnlyComposable
    get() = LocalBantAIColors.current.surfaceElevated
val SurfaceVariant: Color
    @Composable @ReadOnlyComposable
    get() = LocalBantAIColors.current.surfaceVariant
val Hairline: Color
    @Composable @ReadOnlyComposable
    get() = LocalBantAIColors.current.hairline
val BorderColor: Color
    @Composable @ReadOnlyComposable
    get() = LocalBantAIColors.current.border
val TextSecondary: Color
    @Composable @ReadOnlyComposable
    get() = LocalBantAIColors.current.textSecondary
val TextTertiary: Color
    @Composable @ReadOnlyComposable
    get() = LocalBantAIColors.current.textTertiary
val Indigo: Color
    @Composable @ReadOnlyComposable
    get() = LocalBantAIColors.current.indigo
val Danger: Color
    @Composable @ReadOnlyComposable
    get() = LocalBantAIColors.current.danger
val Safe: Color
    @Composable @ReadOnlyComposable
    get() = LocalBantAIColors.current.safe
val Suspicious: Color
    @Composable @ReadOnlyComposable
    get() = LocalBantAIColors.current.suspicious
val IosBlue: Color
    @Composable @ReadOnlyComposable
    get() = LocalBantAIColors.current.iosBlue
val DarkIndigo: Color
    @Composable @ReadOnlyComposable
    get() = LocalBantAIColors.current.darkIndigo
val ProtectionSurface: Color
    @Composable @ReadOnlyComposable
    get() = LocalBantAIColors.current.protectionSurface
val ContactBadge: Color
    @Composable @ReadOnlyComposable
    get() = LocalBantAIColors.current.contactBadge
val GlassFill: Color
    @Composable @ReadOnlyComposable
    get() = LocalBantAIColors.current.glassFill
val GlassStroke: Color
    @Composable @ReadOnlyComposable
    get() = LocalBantAIColors.current.glassStroke
