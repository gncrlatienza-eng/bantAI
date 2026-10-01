package com.bantai.data.local

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.io.IOException

private val Context.blockedSendersDataStore by preferencesDataStore(name = "bantai_blocked_senders")

/**
 * [blocked]: senders BantAI blocked, automatically or at the user's request.
 * [userUnblocked]: senders the user unblocked, which auto-block must leave alone.
 */
data class BlockedSenders(
    val blocked: Set<String> = emptySet(),
    val userUnblocked: Set<String> = emptySet(),
)

/**
 * The phone's own record of who BantAI blocked. Android's block list only
 * takes writes from the default SMS app, and the backend keeps only an HMAC
 * fingerprint of each sender (it can't be listed back as a number), so without
 * this a sender blocked while BantAI wasn't the default app was blocked on the
 * server but appeared nowhere in Blocked Numbers.
 */
class BlockedSendersStore(
    private val context: Context,
) {
    private object Keys {
        val BLOCKED = stringSetPreferencesKey("blocked")
        val USER_UNBLOCKED = stringSetPreferencesKey("user_unblocked")
    }

    val state: Flow<BlockedSenders> =
        context.blockedSendersDataStore.data
            .catch { exception ->
                if (exception is IOException) emit(emptyPreferences()) else throw exception
            }.map { prefs ->
                BlockedSenders(
                    blocked = prefs[Keys.BLOCKED].orEmpty(),
                    userUnblocked = prefs[Keys.USER_UNBLOCKED].orEmpty(),
                )
            }

    suspend fun current(): BlockedSenders = state.first()

    suspend fun markBlocked(sender: String) {
        context.blockedSendersDataStore.edit { prefs ->
            prefs[Keys.BLOCKED] = prefs[Keys.BLOCKED].orEmpty() + sender
            prefs[Keys.USER_UNBLOCKED] = prefs[Keys.USER_UNBLOCKED].orEmpty() - sender
        }
    }

    suspend fun markUnblocked(sender: String) {
        context.blockedSendersDataStore.edit { prefs ->
            prefs[Keys.BLOCKED] = prefs[Keys.BLOCKED].orEmpty() - sender
            prefs[Keys.USER_UNBLOCKED] = prefs[Keys.USER_UNBLOCKED].orEmpty() + sender
        }
    }

    /**
     * Sign-out: the next account starts with an empty Blocked Numbers list,
     * but [BlockedSenders.userUnblocked] is kept. Unblocking is a decision
     * about this phone's block list, which sign-out doesn't touch either;
     * clearing it let the Alerts catch-up (AlertBlocking) re-block those
     * senders on the next sign-in.
     */
    suspend fun clearBlocked() {
        context.blockedSendersDataStore.edit { it.remove(Keys.BLOCKED) }
    }
}
