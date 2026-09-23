package com.bantai.data.local

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import java.security.KeyStore

private const val TAG = "SecureTokenStore"
private const val SECURE_PREFS_NAME = "bantai_secure_prefs"
private const val KEY_AUTH_TOKEN = "auth_token"
private const val ANDROID_KEY_STORE = "AndroidKeyStore"

/**
 * Holds only the JWT bearer token, backed by EncryptedSharedPreferences
 * (AES-256, key held in the Android Keystore) rather than DataStore's plain
 * file. A JWT is a bearer credential, not just readable text — whoever holds
 * the raw string is authenticated as that user, no decoding required — so
 * storing it in an ordinary unencrypted file hands over the session to
 * anything that can read app-private files (root, adb backup, a file-read bug
 * elsewhere), the same class of exposure allowBackup=false already guards
 * against for backups specifically.
 *
 * Every public operation goes through [withPrefs], which self-heals a
 * corrupt store instead of crashing the caller: a device restore, an OS
 * update that resets the Keystore, or a partially-completed previous wipe
 * can leave the master key and the encrypted file out of sync, which
 * surfaces as an exception (e.g. AEADBadTagException) straight out of
 * create()/getString() -- previously uncaught here, so it reached NavGraph's
 * very first cold-start read and crashed the app on every launch with no way
 * to recover short of a manual uninstall. The recovery below just means the
 * user has to sign in again, which is the normal, expected outcome of a
 * token store actually being wiped.
 */
class SecureTokenStore(
    private val context: Context,
) {
    private fun createPrefs(): SharedPreferences {
        val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
        return EncryptedSharedPreferences.create(
            SECURE_PREFS_NAME,
            masterKeyAlias,
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    // Deletes the on-disk file and the Keystore-held key so the next
    // createPrefs() starts from a genuinely clean slate rather than pairing a
    // freshly generated key with stale (now-undecryptable) ciphertext, which
    // would just reproduce the same failure on the very next read.
    private fun wipeCorruptStore() {
        try {
            context
                .getSharedPreferences(SECURE_PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .clear()
                .apply()
            context.deleteSharedPreferences(SECURE_PREFS_NAME)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to clear corrupt prefs file", e)
        }
        try {
            // MasterKeys.MASTER_KEY_ALIAS itself is package-private and not
            // accessible here -- getOrCreate(AES256_GCM_SPEC) returns the same
            // alias string publicly (it's just AES256_GCM_SPEC's own
            // getKeystoreAlias()), generating a fresh key if none exists rather
            // than reading/decrypting anything, so this is safe to call even
            // when the *previous* key's stored ciphertext is what's corrupt.
            val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
            KeyStore.getInstance(ANDROID_KEY_STORE).apply { load(null) }.deleteEntry(masterKeyAlias)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to remove stale master key", e)
        }
    }

    private fun <T> withPrefs(
        recoveryDefault: T,
        block: (SharedPreferences) -> T,
    ): T =
        try {
            block(createPrefs())
        } catch (e: Exception) {
            Log.e(TAG, "Secure token store operation failed; wiping and retrying once", e)
            wipeCorruptStore()
            try {
                block(createPrefs())
            } catch (e2: Exception) {
                Log.e(TAG, "Secure token store still failing after recovery; treating as signed out", e2)
                recoveryDefault
            }
        }

    fun getToken(): String = withPrefs("") { it.getString(KEY_AUTH_TOKEN, "") ?: "" }

    fun saveToken(token: String) {
        withPrefs(Unit) { it.edit().putString(KEY_AUTH_TOKEN, token).apply() }
    }

    fun clear() {
        withPrefs(Unit) { it.edit().remove(KEY_AUTH_TOKEN).apply() }
    }

    /** Mirrors DataStore's Flow semantics so callers can keep combining it with `userData`. */
    val tokenFlow: Flow<String> =
        callbackFlow {
            trySend(getToken())
            val listener =
                SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
                    if (key == KEY_AUTH_TOKEN) trySend(getToken())
                }
            val registeredOn: SharedPreferences? =
                withPrefs(null) { p -> p.also { it.registerOnSharedPreferenceChangeListener(listener) } }
            awaitClose { registeredOn?.unregisterOnSharedPreferenceChangeListener(listener) }
        }
}
