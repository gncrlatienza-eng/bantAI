package com.bantai.data.local

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import org.json.JSONObject
import java.io.IOException

private val Context.classificationsDataStore by preferencesDataStore(name = "bantai_classifications")

/**
 * Persists the real backend/AI classification per message id. Without this, every
 * screen re-derives a message's classification from SmsRepository's local keyword
 * heuristic on every read — including for messages the backend already classified
 * with the actual fine-tuned model at receive time — so the label shown in the UI
 * can silently disagree with the real decision that drove blocking/notifications.
 * The Android SMS provider has no custom column to store this, hence app-local.
 */
class ClassificationStore(
    private val context: Context,
) {
    private object Keys {
        val ENTRIES = stringPreferencesKey("entries")
    }

    val classifications: Flow<Map<Long, String>> =
        context.classificationsDataStore.data
            .catch { exception ->
                if (exception is IOException) emit(emptyPreferences()) else throw exception
            }.map { prefs -> parseEntries(prefs[Keys.ENTRIES] ?: "{}") }

    suspend fun setClassification(
        messageId: Long,
        classification: String,
    ) {
        context.classificationsDataStore.edit { prefs ->
            val current = parseEntries(prefs[Keys.ENTRIES] ?: "{}").toMutableMap()
            current[messageId] = classification
            prefs[Keys.ENTRIES] = serializeEntries(current)
        }
    }

    suspend fun setClassifications(entries: Map<Long, String>) {
        if (entries.isEmpty()) return
        context.classificationsDataStore.edit { prefs ->
            val current = parseEntries(prefs[Keys.ENTRIES] ?: "{}").toMutableMap()
            current.putAll(entries)
            prefs[Keys.ENTRIES] = serializeEntries(current)
        }
    }

    /** Called after a permanent delete so this store doesn't grow forever for ids that no longer exist anywhere. */
    suspend fun remove(messageIds: Collection<Long>) {
        if (messageIds.isEmpty()) return
        context.classificationsDataStore.edit { prefs ->
            val remaining = parseEntries(prefs[Keys.ENTRIES] ?: "{}").filterKeys { it !in messageIds }
            prefs[Keys.ENTRIES] = serializeEntries(remaining)
        }
    }

    suspend fun clear() {
        context.classificationsDataStore.edit { it.clear() }
    }

    private fun parseEntries(json: String): Map<Long, String> {
        val obj =
            try {
                JSONObject(json)
            } catch (_: Exception) {
                return emptyMap()
            }
        val result = mutableMapOf<Long, String>()
        obj.keys().forEach { key ->
            // Skip just this malformed entry rather than discarding every other
            // previously-stored classification because one key/value is bad.
            try {
                result[key.toLong()] = obj.getString(key)
            } catch (_: Exception) {
                // Skipped.
            }
        }
        return result
    }

    private fun serializeEntries(entries: Map<Long, String>): String {
        val obj = JSONObject()
        entries.forEach { (id, classification) -> obj.put(id.toString(), classification) }
        return obj.toString()
    }
}
