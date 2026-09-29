package com.bantai.data.local

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import java.io.IOException

private val Context.alertStateDataStore by preferencesDataStore(name = "bantai_alert_state")

/** Which alerts (by backend messageId) the user has opened, and which they've marked reviewed. */
data class AlertState(
    val initialized: Boolean = false,
    val seen: Set<String> = emptySet(),
    val reviewed: Set<String> = emptySet(),
)

/**
 * Phone-only bookkeeping for the Alerts tab. The backend has no endpoint to
 * change an alert's status (it only lists alerts), and "I've looked at this"
 * is personal state the server doesn't need -- so, like DeletedMessagesStore,
 * it lives on the device only.
 */
class AlertStateStore(
    private val context: Context,
) {
    private object Keys {
        val INITIALIZED = booleanPreferencesKey("initialized")
        val SEEN = stringSetPreferencesKey("seen")
        val REVIEWED = stringSetPreferencesKey("reviewed")
    }

    val state: Flow<AlertState> =
        context.alertStateDataStore.data
            .catch { exception ->
                if (exception is IOException) emit(emptyPreferences()) else throw exception
            }.map { prefs ->
                AlertState(
                    initialized = prefs[Keys.INITIALIZED] ?: false,
                    seen = prefs[Keys.SEEN].orEmpty(),
                    reviewed = prefs[Keys.REVIEWED].orEmpty(),
                )
            }

    /**
     * First load after this feature ships: everything already in the list
     * counts as seen, so an existing user doesn't open the app to a badge of
     * every alert they've ever had.
     */
    suspend fun initializeIfNeeded(currentIds: Collection<String>) {
        context.alertStateDataStore.edit { prefs ->
            if (prefs[Keys.INITIALIZED] == true) return@edit
            prefs[Keys.SEEN] = prefs[Keys.SEEN].orEmpty() + currentIds
            prefs[Keys.INITIALIZED] = true
        }
    }

    suspend fun markSeen(id: String) {
        context.alertStateDataStore.edit { prefs -> prefs[Keys.SEEN] = prefs[Keys.SEEN].orEmpty() + id }
    }

    suspend fun setReviewed(
        id: String,
        reviewed: Boolean,
    ) {
        context.alertStateDataStore.edit { prefs ->
            val current = prefs[Keys.REVIEWED].orEmpty()
            prefs[Keys.REVIEWED] = if (reviewed) current + id else current - id
            // Reviewing an alert implies having seen it.
            if (reviewed) prefs[Keys.SEEN] = prefs[Keys.SEEN].orEmpty() + id
        }
    }

    /** Sign-out: the next account on this device starts fresh. */
    suspend fun clearAll() {
        context.alertStateDataStore.edit { it.clear() }
    }
}
