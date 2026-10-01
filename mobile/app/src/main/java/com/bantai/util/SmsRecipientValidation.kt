package com.bantai.util

private const val MIN_RECIPIENT_DIGITS = 7
private const val MAX_RECIPIENT_DIGITS = 15
private const val MIN_SERVICE_CODE_DIGITS = 3
private const val MAX_SERVICE_CODE_DIGITS = 6
private val SERVICE_CODE_DIGITS = MIN_SERVICE_CODE_DIGITS..MAX_SERVICE_CODE_DIGITS

/** Whether, and how, a thread's sender can be texted back. */
enum class SenderReplyKind {
    /** A real mobile/landline number -- an ordinary reply. */
    PHONE_NUMBER,

    /**
     * A telco/service short code (8080, 3733, 9999...). PH carriers take
     * keywords here (promo registration, load loans, balance checks), so
     * replying is expected -- but a keyword can register a paid promo.
     */
    SERVICE_CODE,

    /** An alphanumeric sender ID ("GCash", "GLOBE", "NDRRMC") -- one-way, no return path. */
    ONE_WAY,
}

fun replyKindFor(sender: String): SenderReplyKind {
    val cleaned = sender.replace(Regex("[\\s\\-()]"), "")
    val digits = cleaned.removePrefix("+")
    return when {
        digits.isEmpty() || !digits.all { it.isDigit() } -> SenderReplyKind.ONE_WAY
        !cleaned.startsWith("+") && digits.length in SERVICE_CODE_DIGITS -> SenderReplyKind.SERVICE_CODE
        digits.length in MIN_RECIPIENT_DIGITS..MAX_RECIPIENT_DIGITS -> SenderReplyKind.PHONE_NUMBER
        else -> SenderReplyKind.ONE_WAY
    }
}

// Only codes confirmed from carrier help pages / real inbox traffic; anything
// else gets the generic service-number caution rather than a guessed name.
private val KNOWN_SERVICE_CODES =
    mapOf(
        "8080" to "Globe/TM promo registration",
        "3733" to "Globe load loan",
        "4438" to "Globe Rewards",
        "9999" to "Smart promos and balance",
        "4545" to "TNT promos",
        "185" to "DITO self-service",
    )

/** What a known PH service short code is for, e.g. "Globe/TM promo registration". */
fun serviceCodeLabel(code: String): String? = KNOWN_SERVICE_CODES[code.filter { it.isDigit() }]

/**
 * Accepts anything that can actually receive an SMS: E.164 or local numbers
 * (7-15 digits) and carrier service short codes (3-6 digits). Rejects
 * alphanumeric sender IDs, which are receive-only -- SMS has no way to route
 * text back to "GCash" or "PLDTHome", so a reply would only fail after
 * SmsSender's 20s timeout.
 *
 * Shared by ComposeScreen and MessageDetailScreen's reply bar. Intentionally
 * separate from OnboardingViewModel's normalizePhone: signup requires a real
 * PH mobile line to receive an OTP -- don't merge the two.
 */
fun isValidSmsRecipient(number: String): Boolean = replyKindFor(number) != SenderReplyKind.ONE_WAY
