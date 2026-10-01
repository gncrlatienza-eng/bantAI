package com.bantai.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
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
    @Query("SELECT * FROM pending_mms")
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

    @Upsert
    suspend fun upsert(rows: List<ClassificationEntity>)

    @Query("DELETE FROM classifications WHERE message_id IN (:ids)")
    suspend fun delete(ids: List<Long>)

    @Query("DELETE FROM classifications")
    suspend fun clear()
}
