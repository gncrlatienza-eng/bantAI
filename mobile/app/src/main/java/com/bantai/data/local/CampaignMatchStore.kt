package com.bantai.data.local

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.bantai.data.remote.SmsApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import org.json.JSONObject
import java.io.IOException

private val Context.campaignMatchDataStore by preferencesDataStore(name = "bantai_campaign_matches")

/**
 * What the backend said each local SMS row belongs to (`IngestResult.campaign`),
 * so the Campaigns tab can group this phone's own messages on the device.
 *
 * An entry with a null [SmsApi.CampaignMatch] means "checked, no campaign" --
 * kept so a refresh doesn't re-send every unmatched message on each open.
 */
class CampaignMatchStore(
    private val context: Context,
) {
    private object Keys {
        val ENTRIES = stringPreferencesKey("entries")
    }

    val entries: Flow<Map<Long, SmsApi.CampaignMatch?>> =
        context.campaignMatchDataStore.data
            .catch { exception ->
                if (exception is IOException) emit(emptyPreferences()) else throw exception
            }.map { prefs -> parseEntries(prefs[Keys.ENTRIES] ?: "{}") }

    suspend fun set(
        localMessageId: Long,
        match: SmsApi.CampaignMatch?,
    ) {
        context.campaignMatchDataStore.edit { prefs ->
            val current = parseEntries(prefs[Keys.ENTRIES] ?: "{}").toMutableMap()
            current[localMessageId] = match
            prefs[Keys.ENTRIES] = serializeEntries(current)
        }
    }

    suspend fun snapshot(): Map<Long, SmsApi.CampaignMatch?> = entries.first()

    /** Called after a permanent delete so this store doesn't grow forever. */
    suspend fun remove(localMessageIds: Collection<Long>) {
        if (localMessageIds.isEmpty()) return
        context.campaignMatchDataStore.edit { prefs ->
            val remaining = parseEntries(prefs[Keys.ENTRIES] ?: "{}").filterKeys { it !in localMessageIds }
            prefs[Keys.ENTRIES] = serializeEntries(remaining)
        }
    }

    suspend fun clear() {
        context.campaignMatchDataStore.edit { it.clear() }
    }

    private fun parseEntries(json: String): Map<Long, SmsApi.CampaignMatch?> {
        val obj =
            try {
                JSONObject(json)
            } catch (_: Exception) {
                return emptyMap()
            }
        val result = mutableMapOf<Long, SmsApi.CampaignMatch?>()
        obj.keys().forEach { key ->
            // Skip just this malformed entry rather than every stored match.
            try {
                val entry = obj.getJSONObject(key)
                val id = entry.optString("id")
                result[key.toLong()] =
                    if (id.isEmpty()) {
                        null
                    } else {
                        SmsApi.CampaignMatch(
                            id = id,
                            label = entry.optString("label").takeIf { it.isNotEmpty() },
                            category = entry.optString("category").takeIf { it.isNotEmpty() },
                        )
                    }
            } catch (_: Exception) {
                // Skipped.
            }
        }
        return result
    }

    private fun serializeEntries(entries: Map<Long, SmsApi.CampaignMatch?>): String {
        val obj = JSONObject()
        entries.forEach { (localId, match) ->
            obj.put(
                localId.toString(),
                JSONObject()
                    .put("id", match?.id ?: "")
                    .put("label", match?.label ?: "")
                    .put("category", match?.category ?: ""),
            )
        }
        return obj.toString()
    }
}
