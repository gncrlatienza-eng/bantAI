package com.bantai.util

import java.text.Normalizer

/**
 * Produces the minimum useful text for remote model classification. URLs,
 * Philippine phone numbers, OTPs, and values are replaced on-device before a
 * request leaves the handset. Domains are collected separately for local
 * campaign matching and are not retained as message text by the backend.
 */
object SmsPrivacyMasker {
    private const val MAX_MASKED_BODY_LENGTH = 1600
    private val url = Regex("\\bhttps?://[^\\s<>()]+", RegexOption.IGNORE_CASE)
    private val bareDomain =
        Regex(
            "\\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)" +
                "(?:com|net|org|ph|io|co|xyz|info|tk|top|link|app)(?:/[^\\s<>()]*)?",
            RegexOption.IGNORE_CASE,
        )
    private val phone = Regex("(?<!\\w)(?:\\+63|0)9\\d{9}(?!\\w)")
    private val money = Regex("(?:₱|PHP\\s?)\\d+(?:[,.]\\d+)?", RegexOption.IGNORE_CASE)
    private val otp = Regex("(?i)\\b(otp|code|pin)(\\D{0,12})\\d{4,8}\\b")

    fun maskForRemoteClassification(body: String): String =
        Normalizer
            .normalize(body, Normalizer.Form.NFKC)
            .replace(url, "[URL]")
            .replace(bareDomain, "[URL]")
            .replace(phone, "[PHONE]")
            .replace(money, "[AMOUNT]")
            .replace(otp) { match -> "${match.groupValues[1]}${match.groupValues[2]}[OTP]" }
            .replace(Regex("\\s+"), " ")
            .trim()
            .take(MAX_MASKED_BODY_LENGTH)
}
