package com.bantai.util

import android.annotation.SuppressLint
import android.content.Context
import android.provider.Settings
import java.security.MessageDigest

// 8 bytes (16 hex chars): plenty to keep one account's devices apart.
private const val DEVICE_KEY_BYTES = 8

/**
 * The `sourceId` sent with every ingested SMS. The backend dedupes on
 * (userId, sourceId), but alerts are account-wide, so a bare SMS row id let two
 * phones on one account collide (row 42 on the second phone came back as the
 * first phone's message) and let an alert resolve to the wrong local SMS.
 * Prefixing a per-device key keeps both apart without a backend schema change.
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

    // ANDROID_ID is scoped to this app's signing key and survives reinstalls,
    // so SMS rows (which also survive) keep the same sourceId. Hashed and
    // truncated: the backend only needs it to be distinct, not the raw value.
    @SuppressLint("HardwareIds")
    private fun deviceKey(context: Context): String =
        cachedKey ?: run {
            val resolver = context.applicationContext.contentResolver
            val androidId = Settings.Secure.getString(resolver, Settings.Secure.ANDROID_ID).orEmpty()
            MessageDigest
                .getInstance("SHA-256")
                .digest(androidId.toByteArray())
                .take(DEVICE_KEY_BYTES)
                .joinToString("") { "%02x".format(it) }
                .also { cachedKey = it }
        }
}
