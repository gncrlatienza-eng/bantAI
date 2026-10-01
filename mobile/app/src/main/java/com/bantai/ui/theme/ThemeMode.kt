package com.bantai.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable

/** Stored in UserPreferences as its [value]; [DARK] is the default (the app's original look). */
enum class ThemeMode(
    val value: String,
    val label: String,
) {
    SYSTEM("system", "Automatic"),
    LIGHT("light", "Light"),
    DARK("dark", "Dark"),
    ;

    companion object {
        fun fromValue(value: String?): ThemeMode = entries.firstOrNull { it.value == value } ?: DARK
    }
}

@Composable
fun ThemeMode.isDark(): Boolean =
    when (this) {
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }
