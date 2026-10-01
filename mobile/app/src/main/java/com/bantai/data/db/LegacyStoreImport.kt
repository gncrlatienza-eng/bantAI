package com.bantai.data.db

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.util.Log
import androidx.datastore.preferences.core.edit
import androidx.sqlite.db.SupportSQLiteDatabase
import com.bantai.data.local.CLASSIFICATION_ENTRIES_KEY
import com.bantai.data.local.classificationsDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

private const val TAG = "LegacyStoreImport"
private const val LEGACY_MESSAGES_FILE = "local_messages.json"

/**
 * One-time copy of the pre-Room stores into the new database: the
 * `local_messages.json` file (LocalMessageStore) and the one-key DataStore
 * blob of classifications (ClassificationStore). Called from Room's onCreate,
 * which runs on the background thread that first opens the database, so the
 * blocking DataStore read here never touches the main thread.
 */
internal object LegacyStoreImport {
    fun run(
        context: Context,
        db: SupportSQLiteDatabase,
    ) {
        // Separately, so a bad messages file doesn't also cost the classifications.
        runCatching { importMessages(context, db) }.onFailure { Log.e(TAG, "Kept-messages import failed", it) }
        runCatching { importClassifications(context, db) }.onFailure { Log.e(TAG, "Classifications import failed", it) }
    }

    private fun importMessages(
        context: Context,
        db: SupportSQLiteDatabase,
    ) {
        val file = File(context.filesDir, LEGACY_MESSAGES_FILE)
        if (!file.exists()) return
        val root = JSONObject(file.readText())
        val rows = root.optJSONArray("rows") ?: JSONArray()
        for (i in 0 until rows.length()) {
            val o = rows.getJSONObject(i)
            val values =
                ContentValues().apply {
                    put("id", o.getLong("id"))
                    put("address", o.getString("address"))
                    put("body", o.getString("body"))
                    put("date", o.getLong("date"))
                    put("type", o.getInt("type"))
                    put("read", if (o.optBoolean("read", true)) 1 else 0)
                    put("sub_id", o.optInt("subId", -1))
                }
            db.insert("local_messages", SQLiteDatabase.CONFLICT_REPLACE, values)
        }
        importOverrides(db, root.optJSONArray("readIds"), MessageOverrideEntity.READ)
        importOverrides(db, root.optJSONArray("deletedIds"), MessageOverrideEntity.DELETED)
        if (!file.renameTo(File(context.filesDir, "$LEGACY_MESSAGES_FILE.migrated"))) file.delete()
        Log.i(TAG, "Imported ${rows.length()} kept messages")
    }

    private fun importOverrides(
        db: SupportSQLiteDatabase,
        ids: JSONArray?,
        kind: String,
    ) {
        if (ids == null) return
        for (i in 0 until ids.length()) {
            val values =
                ContentValues().apply {
                    put("message_id", ids.getLong(i))
                    put("kind", kind)
                }
            db.insert("message_overrides", SQLiteDatabase.CONFLICT_IGNORE, values)
        }
    }

    private fun importClassifications(
        context: Context,
        db: SupportSQLiteDatabase,
    ) {
        val json =
            runBlocking { context.classificationsDataStore.data.first()[CLASSIFICATION_ENTRIES_KEY] }
                ?: return
        val obj = runCatching { JSONObject(json) }.getOrNull() ?: return
        var count = 0
        obj.keys().forEach { key ->
            val id = key.toLongOrNull() ?: return@forEach
            val label = obj.optString(key).takeIf { it.isNotEmpty() } ?: return@forEach
            val values =
                ContentValues().apply {
                    put("message_id", id)
                    put("label", label)
                }
            db.insert("classifications", SQLiteDatabase.CONFLICT_REPLACE, values)
            count++
        }
        runBlocking { context.classificationsDataStore.edit { it.remove(CLASSIFICATION_ENTRIES_KEY) } }
        Log.i(TAG, "Imported $count classifications")
    }
}
