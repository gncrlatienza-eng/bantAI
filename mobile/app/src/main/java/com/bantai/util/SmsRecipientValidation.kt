package com.bantai.util

private const val MIN_RECIPIENT_DIGITS = 7
private const val MAX_RECIPIENT_DIGITS = 15

/**
 * Accept E.164 (+[1-15 digits]) or local all-digit numbers (7-15 digits).
 * Rejects alphanumeric sender IDs (which are receive-only, e.g. "GCash",
 * "PLDTHome") and short codes below 7 digits, to prevent accidental sends to
 * premium-rate services.
 *
 * Shared by ComposeScreen (typing/pasting a recipient) and MessageDetailScreen
 * (the reply bar) so a thread whose sender is an alphanumeric ID never offers
 * a reply action that's guaranteed to fail after SmsSender's 20s timeout --
 * SMS has no way to route text back to a sender ID at all, unlike a real
 * phone number.
 *
 * Intentionally separate from OnboardingViewModel's normalizePhone: signup
 * requires a real PH mobile line to receive an OTP, so it validates and
 * rewrites to +63 form. This just needs "is this a plausible SMS-capable
 * recipient" for any number, PH or not -- don't merge the two.
 */
fun isValidSmsRecipient(number: String): Boolean {
    val cleaned = number.replace(Regex("[\\s\\-()]"), "")
    if (cleaned.startsWith("+")) {
        val digits = cleaned.drop(1)
        return digits.all { it.isDigit() } && digits.length in MIN_RECIPIENT_DIGITS..MAX_RECIPIENT_DIGITS
    }
    return cleaned.all { it.isDigit() } && cleaned.length in MIN_RECIPIENT_DIGITS..MAX_RECIPIENT_DIGITS
}
