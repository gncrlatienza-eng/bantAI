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

    private fun parseEntries(json: String): Map<Long, String> =
        try {
            val obj = JSONObject(json)
            obj.keys().asSequence().associate { key -> key.toLong() to obj.getString(key) }
        } catch (_: Exception) {
            emptyMap()
        }

    private fun serializeEntries(entries: Map<Long, String>): String {
        val obj = JSONObject()
        entries.forEach { (id, classification) -> obj.put(id.toString(), classification) }
        return obj.toString()
    }
}
