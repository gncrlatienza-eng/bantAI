package com.bantai.data.local

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException

private val Context.deletedMessagesDataStore by preferencesDataStore(name = "bantai_deleted_messages")

data class DeletedEntry(val id: Long, val deletedAt: Long)

/**
 * Android's SMS provider has no trash/soft-delete concept, and only the default
 * SMS app may touch it at all — so "Recently Deleted" is purely an app-local
 * bookkeeping layer. Messages stay in the real SMS database untouched until the
 * user permanently deletes them; this store just tracks which ids to hide from
 * the normal views and show under Recently Deleted instead.
 */
class DeletedMessagesStore(private val context: Context) {

    private object Keys {
        val ENTRIES = stringPreferencesKey("entries")
    }

    val deletedEntries: Flow<List<DeletedEntry>> = context.deletedMessagesDataStore.data
        .catch { exception ->
            if (exception is IOException) emit(emptyPreferences()) else throw exception
        }
        .map { prefs -> parseEntries(prefs[Keys.ENTRIES] ?: "[]") }

    suspend fun markDeleted(ids: Collection<Long>) {
        if (ids.isEmpty()) return
        val now = System.currentTimeMillis()
        context.deletedMessagesDataStore.edit { prefs ->
            val current = parseEntries(prefs[Keys.ENTRIES] ?: "[]").associateBy { it.id }.toMutableMap()
            ids.forEach { id -> current[id] = DeletedEntry(id, now) }
            prefs[Keys.ENTRIES] = serializeEntries(current.values.toList())
        }
    }

    /** Also used after a permanent delete succeeds — the soft-delete record is meaningless once the row is truly gone. */
    suspend fun clear(ids: Collection<Long>) {
        if (ids.isEmpty()) return
        context.deletedMessagesDataStore.edit { prefs ->
            val remaining = parseEntries(prefs[Keys.ENTRIES] ?: "[]").filterNot { it.id in ids }
            prefs[Keys.ENTRIES] = serializeEntries(remaining)
        }
    }

    private fun parseEntries(json: String): List<DeletedEntry> = try {
        val array = JSONArray(json)
        List(array.length()) { i ->
            val obj = array.getJSONObject(i)
            DeletedEntry(id = obj.getLong("id"), deletedAt = obj.getLong("deletedAt"))
        }
    } catch (_: Exception) {
        emptyList()
    }

    private fun serializeEntries(entries: List<DeletedEntry>): String {
        val array = JSONArray()
        entries.forEach { entry ->
            array.put(JSONObject().apply {
                put("id", entry.id)
                put("deletedAt", entry.deletedAt)
            })
        }
        return array.toString()
    }
}
