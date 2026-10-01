package com.bantai.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.bantai.data.db.BantaiDatabase
import com.bantai.data.db.ClassificationEntity
import com.bantai.data.model.Classification
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

// Where classifications lived before the Room table; kept only so
// LegacyStoreImport can read (and then clear) it once on upgrade.
internal val Context.classificationsDataStore: DataStore<Preferences>
    by preferencesDataStore(name = "bantai_classifications")
internal val CLASSIFICATION_ENTRIES_KEY = stringPreferencesKey("entries")

// SQLite's host-parameter cap is ~999.
private const val DELETE_CHUNK_SIZE = 900

/**
 * Persists the real backend/AI classification per message id, so screens show
 * the verdict that drove blocking/notifications instead of re-deriving it from
 * the local keyword heuristic. The SMS provider has no column for this.
 */
class ClassificationStore(
    context: Context,
) {
    private val dao = BantaiDatabase.get(context).classifications()

    val classifications: Flow<Map<Long, Classification>> = dao.observeAll().map { it.toMap() }

    /** Blocking snapshot for SmsRepository's (already off-main-thread) queries. */
    fun snapshot(): Map<Long, Classification> = dao.all().toMap()

    /** One message's stored verdict, or null. */
    suspend fun snapshotFor(messageId: Long): Classification? = classifications.first()[messageId]

    suspend fun setClassification(
        messageId: Long,
        classification: Classification,
    ) = dao.upsert(listOf(ClassificationEntity(messageId, classification.storage)))

    suspend fun setClassifications(entries: Map<Long, Classification>) {
        if (entries.isEmpty()) return
        dao.upsert(entries.map { (id, label) -> ClassificationEntity(id, label.storage) })
    }

    /** Called after a permanent delete so this table doesn't grow forever for ids that no longer exist anywhere. */
    suspend fun remove(messageIds: Collection<Long>) {
        for (chunk in messageIds.toList().chunked(DELETE_CHUNK_SIZE)) dao.delete(chunk)
    }

    suspend fun clear() = dao.clear()

    // A label this build doesn't know is skipped (reads as unlabelled) rather than guessed.
    private fun List<ClassificationEntity>.toMap(): Map<Long, Classification> =
        mapNotNull { row ->
            Classification.fromStorage(row.label)?.let { row.messageId to it }
        }.toMap()
}
