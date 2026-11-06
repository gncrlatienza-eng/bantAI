package com.bantai.util

const val NAME_MAX_LENGTH = 30

private val NAME_ALLOWED_PUNCTUATION = setOf('.', '-', '\'')
private val NAME_REPEATED_PUNCTUATION = Regex("[.\\-']{2,}")

/**
 * Letters, whitespace, and a period/hyphen/apostrophe between letters (real PH
 * names routinely use these: "Ma. Teresa", "Dela Cruz-Santos", "D'Angelo").
 * Shared by onboarding (OnboardingViewModel) and profile editing
 * (SettingsViewModel) so the two paths can't silently diverge on what counts
 * as an acceptable name — they previously did: Settings only validated first
 * name, and re-implemented the check ad hoc instead of sharing it, so last
 * name could be saved with any characters at all there.
 *
 * Explicitly rejects blank input: `"".all { ... }` is vacuously true, so
 * without the `isNotBlank()` guard an empty name would otherwise pass. Both
 * current callers separately reject blank before calling this, but that's not
 * guaranteed for a function whose entire point is being the one shared check.
 *
 * The allowed punctuation must sit between letters -- leading/trailing
 * punctuation ("-Maria", ".Teresa") and doubled punctuation ("Ma--ria",
 * "D''Angelo") are still rejected, so this doesn't degrade into "anything
 * goes"; digits, emoji, and other symbols are rejected exactly as before.
 */
fun isValidName(name: String): Boolean {
    val trimmed = name.trim()
    return trimmed.isNotEmpty() &&
        trimmed.all { it.isLetter() || it.isWhitespace() || it in NAME_ALLOWED_PUNCTUATION } &&
        trimmed.first().isLetter() &&
        trimmed.last().isLetter() &&
        !NAME_REPEATED_PUNCTUATION.containsMatchIn(trimmed)
}
