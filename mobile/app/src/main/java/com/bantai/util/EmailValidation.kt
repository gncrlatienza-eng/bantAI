package com.bantai.util

private val SIMPLE_EMAIL_PATTERN =
    Regex("^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$")

fun normalizeEmailAddress(raw: String): String = raw.trim().lowercase()

fun isValidEmailAddress(raw: String): Boolean {
    val email = normalizeEmailAddress(raw)
    return email.length <= 254 && SIMPLE_EMAIL_PATTERN.matches(email)
}
