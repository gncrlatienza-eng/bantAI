package com.bantai.ui.theme

import androidx.annotation.StringRes
import com.bantai.R

private const val LARGE_FACTOR = 1.15f
private const val LARGER_FACTOR = 1.3f

/**
 * The in-app text size (Settings > Appearance), stored in UserPreferences as
 * its [value]. [factor] multiplies the phone's own font-size setting rather
 * than replacing it, so someone who already enlarged text system-wide gets
 * it larger still. Capped at 1.3x: past that, fixed-height rows (the search
 * pill, the tab bar) start clipping their text. The two together are capped
 * too (BantAITheme), for the same reason.
 */
enum class TextScale(
    val value: String,
    val factor: Float,
    @StringRes val label: Int,
) {
    DEFAULT("default", 1.0f, R.string.settings_text_size_default),
    LARGE("large", LARGE_FACTOR, R.string.settings_text_size_large),
    LARGER("larger", LARGER_FACTOR, R.string.settings_text_size_larger),
    ;

    companion object {
        fun fromValue(value: String?): TextScale = entries.firstOrNull { it.value == value } ?: DEFAULT
    }
}
