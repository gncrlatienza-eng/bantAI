package com.bantai.util

private const val PH_MOBILE_DIGIT_COUNT = 10
private const val PH_MOBILE_LEADING_DIGIT = '9'

/**
 * Normalizes manual entry ("9171234567", "09171234567") and SIM-detected
 * numbers (already "+63 917 123 4567") to the same "+63..." form the backend
 * and every other stored phone number use. Without this, a manually typed
 * number was saved with no country code at all, so it would never match its
 * own SIM-detected form or any other +63 row.
 *
 * Returns null for anything that isn't a plausible PH mobile number (wrong
 * length, a landline, a non-PH number) instead of silently forcing it into a
 * syntactically-plausible-but-wrong "+63..." value.
 *
 * Extracted out of OnboardingViewModel so this pure string logic has a JVM
 * unit test (see PhNumberNormalizationTest) without needing an
 * AndroidViewModel/Application instance just to exercise it.
 */
fun normalizePhNumber(raw: String): String? {
    val trimmed = raw.trim().replace(Regex("[\\s\\-()]"), "")
    // Any "+" prefix that isn't "+63" is a non-PH E.164 number; reject rather
    // than mangle it into a syntactically-plausible-but-wrong +63 value.
    if (trimmed.startsWith("+") && !trimmed.startsWith("+63")) return null
    val digits =
        when {
            trimmed.startsWith("+63") -> trimmed.removePrefix("+63")
            trimmed.startsWith("0063") -> trimmed.removePrefix("0063")
            trimmed.startsWith("63") && trimmed.length > PH_MOBILE_DIGIT_COUNT -> trimmed.removePrefix("63")
            trimmed.startsWith("0") -> trimmed.removePrefix("0")
            else -> trimmed
        }.filter { it.isDigit() }
    return digits
        .takeIf { it.length == PH_MOBILE_DIGIT_COUNT && it.first() == PH_MOBILE_LEADING_DIGIT }
        ?.let { "+63$it" }
}
