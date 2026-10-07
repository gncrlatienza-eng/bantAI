package com.bantai.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

// The blocking (non-suspend) calls below are used by SmsRepository, whose provider
// queries are blocking anyway. Room throws if they run on the main thread, so a
// wrong-thread call fails loudly instead of freezing the app.

@Dao
interface LocalMessageDao {
    @Query("SELECT * FROM local_messages")
    fun all(): List<LocalMessageEntity>

    @Query("SELECT MIN(id) FROM local_messages")
    fun minId(): Long?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insert(row: LocalMessageEntity)

    @Query("UPDATE local_messages SET type = :type WHERE id = :id")
    fun updateType(
        id: Long,
        type: Int,
    ): Int

    @Query("UPDATE local_messages SET read = 1 WHERE id IN (:ids)")
    fun markRead(ids: List<Long>)

    @Query("DELETE FROM local_messages WHERE id IN (:ids)")
    fun delete(ids: List<Long>)
}

@Dao
interface MessageOverrideDao {
    @Query("SELECT message_id FROM message_overrides WHERE kind = :kind")
    fun ids(kind: String): List<Long>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    fun insertAll(rows: List<MessageOverrideEntity>)
}

@Dao
interface MmsAddressDao {
    @Query("SELECT * FROM mms_addresses")
    fun all(): List<MmsAddressEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertAll(rows: List<MmsAddressEntity>)
}

@Dao
interface PendingMmsDao {
    /** Rows still waiting on a download; completed ones only stay for dedupe. */
    @Query("SELECT * FROM pending_mms WHERE state != 'completed'")
    fun all(): List<PendingMmsEntity>

    @Query("SELECT * FROM pending_mms WHERE id = :id")
    fun get(id: Long): PendingMmsEntity?

    /** -1 when this content location is already pending (a repeated notification). */
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    fun insert(row: PendingMmsEntity): Long

    @Query("UPDATE pending_mms SET state = :state WHERE id = :id")
    fun setState(
        id: Long,
        state: String,
    )

    @Query(
        "UPDATE pending_mms SET state = 'downloading', attempts = attempts + 1, attempted_at = :now WHERE id = :id",
    )
    fun startRetry(
        id: Long,
        now: Long,
    )

    @Query("DELETE FROM pending_mms WHERE id IN (:ids)")
    fun delete(ids: List<Long>)

    @Query("DELETE FROM pending_mms WHERE state = 'completed' AND received_at < :cutoff")
    fun pruneCompleted(cutoff: Long)
}

@Dao
interface ReplyQuoteDao {
    @Query("SELECT * FROM reply_quotes WHERE address_key = :addressKey")
    fun forConversation(addressKey: String): Flow<List<ReplyQuoteEntity>>

    @Insert
    suspend fun insert(row: ReplyQuoteEntity)
}

@Dao
interface ClassificationDao {
    @Query("SELECT * FROM classifications")
    fun all(): List<ClassificationEntity>

    @Query("SELECT * FROM classifications")
    fun observeAll(): Flow<List<ClassificationEntity>>

    @Query("SELECT * FROM classifications WHERE message_id = :messageId LIMIT 1")
    suspend fun byMessageId(messageId: Long): ClassificationEntity?

    @Upsert
    suspend fun upsert(rows: List<ClassificationEntity>)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertIfAbsent(row: ClassificationEntity): Long

    @Query(
        """
        UPDATE classifications SET
            label = :label,
            source = 'on_device_model_c',
            model_version = :modelVersion,
            model_sha256 = :modelSha256,
            score = :score,
            classified_at = :classifiedAt
        WHERE message_id = :messageId
          AND label != 'blocked'
          AND (source IS NULL OR source != 'cloud_model')
        """,
    )
    @Suppress("LongParameterList") // Room SQL binds immutable Model C provenance atomically.
    suspend fun updateOnDeviceUnlessCloud(
        messageId: Long,
        label: String,
        modelVersion: String,
        modelSha256: String,
        score: Double,
        classifiedAt: Long,
    ): Int

    @Transaction
    @Suppress("LongParameterList") // Keep the insert/update race boundary and its provenance in one transaction.
    suspend fun writeOnDeviceUnlessCloud(
        messageId: Long,
        label: String,
        modelVersion: String,
        modelSha256: String,
        score: Double,
        classifiedAt: Long,
    ): Int {
        val inserted =
            insertIfAbsent(
                ClassificationEntity(
                    messageId = messageId,
                    label = label,
                    source = "on_device_model_c",
                    modelVersion = modelVersion,
                    modelSha256 = modelSha256,
                    score = score,
                    classifiedAt = classifiedAt,
                ),
            )
        return if (inserted != -1L) {
            1
        } else {
            updateOnDeviceUnlessCloud(messageId, label, modelVersion, modelSha256, score, classifiedAt)
        }
    }

    @Query("DELETE FROM classifications WHERE message_id IN (:ids)")
    suspend fun delete(ids: List<Long>)

    @Query("DELETE FROM classifications")
    suspend fun clear()
}
