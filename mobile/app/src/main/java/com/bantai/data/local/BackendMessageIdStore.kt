package com.bantai.data.local

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import org.json.JSONObject
import java.io.IOException

private val Context.backendMessageIdDataStore by preferencesDataStore(name = "bantai_backend_message_ids")

/**
 * Maps a local SMS provider row id to the backend's `SmsMessage` UUID
 * returned by `POST /sms/ingest` (`IngestResult.messageId`). The device SMS
 * provider has no column for this, and every action that needs a backend id
 * -- submitting a report (`POST /reports`), or opening the Smishing Alert /
 * Take Action screens from a thread rather than from the Alerts tab -- only
 * ever has the local row id to start from. Without this store those actions
 * have no way to resolve one to the other and stay permanently disabled.
 */
class BackendMessageIdStore(
    private val context: Context,
) {
    private object Keys {
        val ENTRIES = stringPreferencesKey("entries")
    }

    val entries: Flow<Map<Long, String>> =
        context.backendMessageIdDataStore.data
            .catch { exception ->
                if (exception is IOException) emit(emptyPreferences()) else throw exception
            }.map { prefs -> parseEntries(prefs[Keys.ENTRIES] ?: "{}") }

    suspend fun set(
        localMessageId: Long,
        backendMessageId: String,
    ) {
        if (backendMessageId.isBlank()) return
        context.backendMessageIdDataStore.edit { prefs ->
            val current = parseEntries(prefs[Keys.ENTRIES] ?: "{}").toMutableMap()
            current[localMessageId] = backendMessageId
            prefs[Keys.ENTRIES] = serializeEntries(current)
        }
    }

    suspend fun get(localMessageId: Long): String? = entries.first()[localMessageId]

    /** Called after a permanent delete so this store doesn't grow forever. */
    suspend fun remove(localMessageIds: Collection<Long>) {
        if (localMessageIds.isEmpty()) return
        context.backendMessageIdDataStore.edit { prefs ->
            val remaining = parseEntries(prefs[Keys.ENTRIES] ?: "{}").filterKeys { it !in localMessageIds }
            prefs[Keys.ENTRIES] = serializeEntries(remaining)
        }
    }

    suspend fun clear() {
        context.backendMessageIdDataStore.edit { it.clear() }
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
            // previously-stored mapping because one key/value is bad.
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
        entries.forEach { (id, backendId) -> obj.put(id.toString(), backendId) }
        return obj.toString()
    }
}
