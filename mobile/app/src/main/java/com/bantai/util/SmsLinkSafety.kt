package com.bantai.util

import com.bantai.data.model.Classification

/** Prevents untrusted SMS links from being displayed as usable-looking text. */
object SmsLinkSafety {
    // Endings scam texts use for bare links (no http/www in front). Anything
    // else is still caught once it has a path ("bit.ly/x", "promo.shop/abc").
    private const val TLDS =
        "com|net|org|ph|io|co|xyz|info|tk|top|link|app|ly|me|cc|gg|to|gl|us|biz|asia|" +
            "shop|site|online|store|live|click|vip|club|icu|cn|ru|win|bid|fun|pw|sbs|cfd|lol|buzz|cyou|today"
    private const val LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"

    // The whole host is matched, every subdomain included, so "secure.bdo-login.com"
    // is hidden in full instead of leaving "secure." behind. A host may only
    // start where a word starts (HOST_START), and its labels are taken
    // atomically: otherwise a long dotted text with no real link was re-scanned
    // from every letter, which took over a second on a crafted message. A dot
    // is only taken when another label follows, so the sentence-ending dot in
    // "go to scam.com." is left for the ending to match against.
    private const val HOST_START = "(?<![a-z0-9.-])"
    private val url =
        Regex(
            "\\b(?:(?:https?://|www\\.)[^\\s<>()]+|" +
                "$HOST_START(?>(?:$LABEL\\.(?=[a-z0-9]))+)(?:(?:$TLDS)\\b(?:/[^\\s<>()]*)?|[a-z]{2,24}/[^\\s<>()]*))",
            RegexOption.IGNORE_CASE,
        )

    /**
     * Links stay visible only in a message rated safe -- and not even then when
     * it's under a trusted name but shows a spoof sign (a bank sending a link,
     * an OTP request; see SmsRiskSignals.spoofWarning), since the model can
     * rate a well-forged "BDO" text safe.
     */
    fun visibleBody(
        body: String,
        classification: Classification,
        sender: String = "",
    ): String =
        if (classification == Classification.SAFE && SmsRiskSignals.spoofWarning(sender, body) == null) {
            body
        } else {
            hideLinks(body)
        }

    fun hideLinks(text: String): String = text.replace(url, LINK_HIDDEN)

    /**
     * For scam texts shown outside their own conversation (Scam Waves, alert
     * previews): links hidden, plus the phone numbers, emails, codes and
     * account numbers a scam carries, so nothing in it can be acted on.
     */
    fun maskSensitive(text: String): String = SmsPrivacyMasker.maskIdentifiersForDisplay(hideLinks(text))

    /** A link shown as text but not openable: "bdo-login.com" -> "bdo-login[.]com". */
    fun defang(domain: String): String = domain.replace(".", "[.]")

    const val LINK_HIDDEN = "[Link hidden for safety]"
}
