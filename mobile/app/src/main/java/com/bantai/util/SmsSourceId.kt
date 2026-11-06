package com.bantai.util

import android.annotation.SuppressLint
import android.content.Context
import android.provider.Settings
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

// 8 bytes (16 hex chars): plenty to keep one account's devices apart.
private const val DEVICE_KEY_BYTES = 8
private const val INSTALL_SECRET_BYTES = 32
private const val PREFS_NAME = "bantai_sms_source_id"
private const val PREF_INSTALL_SECRET = "install_secret"
private const val PREF_ACCOUNT_KEY = "account_key"
private const val HMAC = "HmacSHA256"

/**
 * The `sourceId` sent with every ingested SMS. The backend dedupes on
 * (userId, sourceId), but alerts are account-wide, so a bare SMS row id let two
 * phones on one account collide (row 42 on the second phone came back as the
 * first phone's message) and let an alert resolve to the wrong local SMS.
 * Prefixing a per-device key keeps both apart without a backend schema change.
 *
 * The key is account-scoped: HMAC(install secret, account id). The install
 * secret is random, generated on this install and never sent, so the same
 * account on the same install always gets the same key (re-scans dedupe), while
 * two accounts used on one phone get unrelated keys. It used to be a hash of
 * ANDROID_ID, which is identical for every account on the device and survives
 * reinstalls, so the server could link separate accounts to one phone (audit
 * ANDROID-02, 2026-10-13).
 */
object SmsSourceId {
    @Volatile private var cachedKey: String? = null

    fun forRow(
        context: Context,
        rowId: Long,
    ): String = "${deviceKey(context)}:$rowId"

    /** Used only when the inbox insert failed; never resolves to a local row. */
    fun forUnstoredMessage(
        context: Context,
        sender: String,
        receivedAt: Long,
    ): String = "${deviceKey(context)}:x${sender.hashCode()}:$receivedAt"

    /**
     * The local SMS row id this sourceId refers to, or null when it came from
     * another device. Legacy bare numeric ids (sent before the prefix existed)
     * are assumed local, which matches the old behavior.
     */
    fun localRowId(
        context: Context,
        sourceId: String?,
    ): Long? {
        val prefix = "${deviceKey(context)}:"
        return when {
            sourceId == null -> null
            sourceId.toLongOrNull() != null -> sourceId.toLong()
            sourceId.startsWith(prefix) -> sourceId.removePrefix(prefix).toLongOrNull()
            else -> null
        }
    }

    /** Binds this install to the account that just signed in, from its access token. */
    fun bindAccount(
        context: Context,
        accessToken: String,
    ) {
        // A token without a readable subject still gets a key that cannot be
        // linked to any other account; it just won't be stable across sign-ins.
        val accountId = jwtSubject(accessToken) ?: randomHex(INSTALL_SECRET_BYTES)
        // Same lock as deviceKey(): otherwise a lookup already running on an SMS
        // thread could finish after this and overwrite the new account's key with
        // the ANDROID_ID-based fallback, re-linking accounts for the session.
        synchronized(this) {
            val key = accountKey(installSecret(context), accountId)
            prefs(context).edit().putString(PREF_ACCOUNT_KEY, key).apply()
            cachedKey = key
        }
    }

    /** Sign-out / account deletion: the next account on this phone gets an unrelated key. */
    fun clearAccount(context: Context) {
        synchronized(this) {
            prefs(context).edit().remove(PREF_ACCOUNT_KEY).apply()
            cachedKey = null
        }
    }

    internal fun accountKey(
        installSecret: ByteArray,
        accountId: String,
    ): String {
        val mac = Mac.getInstance(HMAC)
        mac.init(SecretKeySpec(installSecret, HMAC))
        return mac.doFinal(accountId.toByteArray()).toHex(DEVICE_KEY_BYTES)
    }

    /** The JWT `sub` claim (the account id), or null if the token isn't a readable JWT. */
    internal fun jwtSubject(token: String): String? =
        runCatching {
            val payload = String(Base64.getUrlDecoder().decode(token.split('.')[1]))
            Regex("\"sub\"\\s*:\\s*\"([^\"]+)\"").find(payload)?.groupValues?.get(1)
        }.getOrNull()

    private fun deviceKey(context: Context): String =
        cachedKey ?: synchronized(this) {
            cachedKey ?: (prefs(context).getString(PREF_ACCOUNT_KEY, null) ?: legacyKey(context))
                .also { cachedKey = it }
        }

    // Only for a session that signed in before account-scoped keys existed:
    // keeps that account's existing server rows matching until its next
    // sign-in, which replaces this with bindAccount's key.
    @SuppressLint("HardwareIds")
    private fun legacyKey(context: Context): String {
        val resolver = context.applicationContext.contentResolver
        val androidId = Settings.Secure.getString(resolver, Settings.Secure.ANDROID_ID).orEmpty()
        return MessageDigest
            .getInstance("SHA-256")
            .digest(androidId.toByteArray())
            .toHex(DEVICE_KEY_BYTES)
    }

    private fun installSecret(context: Context): ByteArray =
        synchronized(this) {
            val prefs = prefs(context)
            prefs.getString(PREF_INSTALL_SECRET, null)?.let { Base64.getDecoder().decode(it) }
                ?: randomBytes(INSTALL_SECRET_BYTES).also {
                    prefs.edit().putString(PREF_INSTALL_SECRET, Base64.getEncoder().encodeToString(it)).apply()
                }
        }

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private fun randomBytes(count: Int): ByteArray = ByteArray(count).also { SecureRandom().nextBytes(it) }

    private fun randomHex(count: Int): String = randomBytes(count).toHex(count)

    private fun ByteArray.toHex(count: Int): String = take(count).joinToString("") { "%02x".format(it) }
}
