package com.bantai.util

import java.text.Normalizer

/**
 * Produces the minimum useful text for remote model classification. URLs,
 * emails, Philippine phone numbers, OTPs, and values are replaced on-device
 * before a request leaves the handset. Domains are collected separately for
 * local campaign matching and are not retained as message text by the
 * backend.
 *
 * The generic digit-run pass at the end is deliberately broad: a landline
 * number, a bank/card account number, or an OTP sent without a recognizable
 * keyword nearby would otherwise pass through completely unmasked -- only
 * catching a handful of specific patterns (URL, PH mobile number, a
 * keyword-prefixed OTP) left everything else that merely *looks* like a
 * phone/mobile number as plain text in the payload sent to the backend,
 * directly contradicting this class's own "raw SMS never leaves the device"
 * guarantee for anything that wasn't one of those exact shapes.
 */
object SmsPrivacyMasker {
    private const val MAX_MASKED_BODY_LENGTH = 1600

    // How many non-digit characters are allowed between an OTP-ish keyword and
    // the code itself -- wide enough for a full sentence ("Your one-time
    // verification code is: 123456") rather than just "OTP: 123456", since a
    // gap that's too tight left many real OTP messages relying on the generic
    // digit-run mask below instead (still masked, just as a less specific
    // [NUMBER] rather than [OTP]).
    private const val OTP_KEYWORD_GAP = 40

    // A 6-digit run is the shortest thing worth masking on its own -- shorter
    // runs are common in ordinary non-identifying text (a percentage, a small
    // count, a year) and masking those would strip real signal the classifier
    // needs for no privacy benefit.
    private const val MIN_GENERIC_DIGIT_RUN = 6

    private val url = Regex("\\bhttps?://[^\\s<>()]+", RegexOption.IGNORE_CASE)
    private val bareDomain =
        Regex(
            "\\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)" +
                "(?:com|net|org|ph|io|co|xyz|info|tk|top|link|app)(?:/[^\\s<>()]*)?",
            RegexOption.IGNORE_CASE,
        )
    private val email = Regex("\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b")

    // Allows a single space or hyphen between digits (e.g. "0917 123 4567",
    // "+63-917-123-4567") in addition to the unbroken "09171234567" form --
    // previously only the unbroken form matched, so any formatted number fell
    // straight through into the generic digit-run mask below (still masked,
    // but as a less specific [NUMBER]).
    private val phone = Regex("(?<!\\w)(?:\\+63[\\s-]?|0)9(?:[\\s-]?\\d){9}(?!\\w)")

    // `*` (repeatable), not `?` -- a single optional group only matched the first
    // thousands separator in an amount like "1,500.00" ("1,500"), leaving the
    // decimal part (".00") behind as unmasked plain text. Caught by
    // SmsPrivacyMaskerTest while adding this file's other tests.
    private val money = Regex("(?:₱|PHP\\s?)\\d+(?:[,.]\\d+)*", RegexOption.IGNORE_CASE)
    private val otp = Regex("(?i)\\b(otp|code|pin)(\\D{0,$OTP_KEYWORD_GAP})\\d{4,8}\\b")

    // Catch-all for anything left that reads as an identifying number --
    // landlines, bank/e-wallet account numbers, card numbers, reference
    // numbers, an OTP with no recognizable keyword nearby -- none of which the
    // specific patterns above are shaped to catch. Runs last, after URL/email/
    // PH-mobile/amount/keyword-OTP have already claimed their own digits, so
    // this only ever sees what those left behind.
    private val genericDigitRun = Regex("(?<!\\w)\\d(?:[\\s-]?\\d){${MIN_GENERIC_DIGIT_RUN - 1},}(?!\\w)")

    fun maskForRemoteClassification(body: String): String =
        Normalizer
            .normalize(body, Normalizer.Form.NFKC)
            .replace(url, "[URL]")
            // email before bareDomain: bareDomain's pattern also matches an
            // email's domain half on its own ("user@example.com" -> the
            // "example.com" part alone satisfies it), and running bareDomain
            // first would leave "user@[URL]" behind -- fully masking the
            // domain but leaking the local part, which looks masked at a
            // glance but isn't.
            .replace(email, "[EMAIL]")
            .replace(bareDomain, "[URL]")
            .replace(phone, "[PHONE]")
            .replace(money, "[AMOUNT]")
            .replace(otp) { match -> "${match.groupValues[1]}${match.groupValues[2]}[OTP]" }
            .replace(genericDigitRun, "[NUMBER]")
            .replace(Regex("\\s+"), " ")
            .trim()
            .take(MAX_MASKED_BODY_LENGTH)
}
