package com.bantai.data.local

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.bantai.data.model.normalizeSenderKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException

private val Context.draftsDataStore by preferencesDataStore(name = "bantai_drafts")

data class DraftEntry(val address: String, val body: String, val updatedAt: Long)

/**
 * Unsent Compose text, kept app-local — the SMS provider has no draft concept at
 * all, so unlike Inbox/Sent/deleted-tracking this has no relationship to real
 * provider rows. One draft per recipient (keyed by normalized address), matching
 * how a normal messaging app keeps at most one draft per conversation.
 */
class DraftsStore(private val context: Context) {

    private object Keys {
        val ENTRIES = stringPreferencesKey("entries")
    }

    val drafts: Flow<List<DraftEntry>> = context.draftsDataStore.data
        .catch { exception ->
            if (exception is IOException) emit(emptyPreferences()) else throw exception
        }
        .map { prefs -> parseEntries(prefs[Keys.ENTRIES] ?: "[]") }

    /** A blank body clears any existing draft for that recipient rather than storing an empty one. */
    suspend fun saveDraft(address: String, body: String) {
        val key = normalizeSenderKey(address)
        context.draftsDataStore.edit { prefs ->
            val current = parseEntries(prefs[Keys.ENTRIES] ?: "[]")
                .associateBy { normalizeSenderKey(it.address) }
                .toMutableMap()
            if (body.isBlank()) {
                current.remove(key)
            } else {
                current[key] = DraftEntry(address, body, System.currentTimeMillis())
            }
            prefs[Keys.ENTRIES] = serializeEntries(current.values.toList())
        }
    }

    suspend fun deleteDraft(address: String) {
        val key = normalizeSenderKey(address)
        context.draftsDataStore.edit { prefs ->
            val remaining = parseEntries(prefs[Keys.ENTRIES] ?: "[]")
                .filterNot { normalizeSenderKey(it.address) == key }
            prefs[Keys.ENTRIES] = serializeEntries(remaining)
        }
    }

    private fun parseEntries(json: String): List<DraftEntry> = try {
        val array = JSONArray(json)
        List(array.length()) { i ->
            val obj = array.getJSONObject(i)
            DraftEntry(
                address = obj.getString("address"),
                body = obj.getString("body"),
                updatedAt = obj.getLong("updatedAt"),
            )
        }
    } catch (_: Exception) {
        emptyList()
    }

    private fun serializeEntries(entries: List<DraftEntry>): String {
        val array = JSONArray()
        entries.forEach { entry ->
            array.put(JSONObject().apply {
                put("address", entry.address)
                put("body", entry.body)
                put("updatedAt", entry.updatedAt)
            })
        }
        return array.toString()
    }
}
