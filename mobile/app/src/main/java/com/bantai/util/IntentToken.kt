package com.bantai.util

import android.content.Context
import java.security.SecureRandom

private const val PREFS = "bantai_intent_token"
private const val KEY = "token"
private const val TOKEN_BYTES = 16

/**
 * A per-install secret that BantAI puts on its own notification taps.
 * MainActivity has to be open to other apps (it handles "send SMS" links), so
 * without this any app could launch it with the notification extras and jump
 * it into a chosen conversation or tab. Extras are only honored when they
 * carry this token.
 */
object IntentToken {
    const val EXTRA = "com.bantai.extra.INTENT_TOKEN"

    @Volatile private var cached: String? = null

    fun get(context: Context): String {
        cached?.let { return it }
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val token =
            prefs.getString(KEY, null) ?: run {
                val bytes = ByteArray(TOKEN_BYTES).also { SecureRandom().nextBytes(it) }
                bytes.joinToString("") { "%02x".format(it) }.also { prefs.edit().putString(KEY, it).apply() }
            }
        cached = token
        return token
    }

    fun isTrusted(
        context: Context,
        presented: String?,
    ): Boolean = presented != null && presented == get(context)
}
