package com.bantai.util

/** Prevents untrusted SMS links from being displayed as usable-looking text. */
object SmsLinkSafety {
    private val url =
        Regex(
            "\\b(?:(?:https?://|www\\.)[^\\s<>()]+|" +
                "(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)" +
                "(?:com|net|org|ph|io|co|xyz|info|tk|top|link|app)(?:/[^\\s<>()]*)?)",
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
        classification: String,
        sender: String = "",
    ): String =
        if (classification == "safe" && SmsRiskSignals.spoofWarning(sender, body) == null) {
            body
        } else {
            hideLinks(body)
        }

    fun hideLinks(text: String): String = text.replace(url, "[Link hidden for safety]")
}
