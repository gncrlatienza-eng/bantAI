package com.bantai.data.local

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

private const val SECURE_PREFS_NAME = "bantai_secure_prefs"
private const val KEY_AUTH_TOKEN = "auth_token"

/**
 * Holds only the JWT bearer token, backed by EncryptedSharedPreferences
 * (AES-256, key held in the Android Keystore) rather than DataStore's plain
 * file. A JWT is a bearer credential, not just readable text — whoever holds
 * the raw string is authenticated as that user, no decoding required — so
 * storing it in an ordinary unencrypted file hands over the session to
 * anything that can read app-private files (root, adb backup, a file-read bug
 * elsewhere), the same class of exposure allowBackup=false already guards
 * against for backups specifically.
 */
class SecureTokenStore(
    context: Context,
) {
    private val prefs: SharedPreferences by lazy {
        val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
        EncryptedSharedPreferences.create(
            SECURE_PREFS_NAME,
            masterKeyAlias,
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    fun getToken(): String = prefs.getString(KEY_AUTH_TOKEN, "") ?: ""

    fun saveToken(token: String) {
        prefs.edit().putString(KEY_AUTH_TOKEN, token).apply()
    }

    fun clear() {
        prefs.edit().remove(KEY_AUTH_TOKEN).apply()
    }

    /** Mirrors DataStore's Flow semantics so callers can keep combining it with `userData`. */
    val tokenFlow: Flow<String> =
        callbackFlow {
            trySend(getToken())
            val listener =
                SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
                    if (key == KEY_AUTH_TOKEN) trySend(getToken())
                }
            prefs.registerOnSharedPreferenceChangeListener(listener)
            awaitClose { prefs.unregisterOnSharedPreferenceChangeListener(listener) }
        }
}
