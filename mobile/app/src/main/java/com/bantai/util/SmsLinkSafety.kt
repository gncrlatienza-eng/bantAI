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

    fun visibleBody(
        body: String,
        classification: String,
    ): String =
        if (classification == "safe") {
            body
        } else {
            body.replace(url, "[Link hidden for safety]")
        }
}
