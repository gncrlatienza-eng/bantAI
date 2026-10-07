package com.bantai.data.offline

import java.text.Normalizer

/** Exact Android implementation of ai/preprocessing's nfkc_whitespace_pii_v1 contract. */
internal object ModelCPreprocessor {
    // Python's Unicode re classes, written explicitly so the JVM unit tests and
    // Android's ICU regex engine behave identically (Android does not support
    // Java's UNICODE_CHARACTER_CLASS flag).
    private const val PY_SPACE = "\\t\\n\\u000B\\u000C\\r\\u001C-\\u001F\\u0085\\p{Z}"

    // Python str.isalnum categories plus underscore. Combining marks and other
    // connector punctuation are not Python \w (verified against the source runtime).
    private const val PY_WORD = "\\p{L}\\p{N}_"
    private const val PY_DIGIT = "\\p{Nd}"
    private val whitespace = Regex("[$PY_SPACE]+")
    private val email =
        Regex(
            "\\b[a-z0-9._%+\\-]+@[a-z0-9](?:[a-z0-9\\-]*[a-z0-9])?" +
                "(?:\\.[a-z0-9\\-]+)*\\.[a-z]{2,24}\\b",
            RegexOption.IGNORE_CASE,
        )
    private val url =
        Regex(
            "\\b(?:h(?:tt|xx)ps?://|www\\.)[^$PY_SPACE]+|" +
                "\\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+" +
                "[a-z]{2,24}\\b(?:/[^$PY_SPACE]*)?",
            RegexOption.IGNORE_CASE,
        )
    private val phone =
        Regex(
            "(?<![$PY_WORD])(?:\\+?63[$PY_SPACE.\\-]?9$PY_DIGIT{2}[$PY_SPACE.\\-]?$PY_DIGIT{3}" +
                "[$PY_SPACE.\\-]?$PY_DIGIT{4}|09$PY_DIGIT{2}[$PY_SPACE.\\-]?$PY_DIGIT{3}" +
                "[$PY_SPACE.\\-]?$PY_DIGIT{4}|\\(?0$PY_DIGIT{1,2}\\)?[$PY_SPACE.\\-]?$PY_DIGIT{3,4}" +
                "[$PY_SPACE.\\-]?$PY_DIGIT{4}|\\+$PY_DIGIT{7,14})(?![$PY_WORD])",
        )
    private val amount =
        Regex(
            "(?<![A-Za-z0-9])(?:(?:₱|php|p)[$PY_SPACE]?$PY_DIGIT[$PY_DIGIT,]*" +
                "(?:\\.$PY_DIGIT{1,2})?[km]?|$PY_DIGIT[$PY_DIGIT,]*(?:\\.$PY_DIGIT{1,2})?[km]?" +
                "[$PY_SPACE]?(?:pesos|php))",
            RegexOption.IGNORE_CASE,
        )
    private val otp = Regex("(?<!$PY_DIGIT)$PY_DIGIT{4,8}(?!$PY_DIGIT)")

    fun preprocess(raw: String): String =
        Normalizer
            .normalize(raw, Normalizer.Form.NFKC)
            .replace(whitespace, " ")
            .trim()
            .replace(email, "<EMAIL>")
            .replace(url, "<URL>")
            .replace(phone, "<PHONE>")
            .replace(amount, "<AMOUNT>")
            .replace(otp, "<OTP>")
}
