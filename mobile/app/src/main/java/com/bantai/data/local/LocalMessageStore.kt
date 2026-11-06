package com.bantai.data.local

import android.content.Context
import com.bantai.data.db.BantaiDatabase
import com.bantai.data.db.LocalMessageEntity
import com.bantai.data.db.MessageOverrideEntity

// Local ids count down from -now*1000, so an id made in this run is always
// below every id handed out in an earlier one: no collisions across restarts.
private const val LOCAL_ID_SPACING = 1000L

// SQLite's host-parameter cap is ~999.
private const val IN_CLAUSE_CHUNK_SIZE = 900

/** One message kept by BantAI itself (see [LocalMessageStore]). [type] uses Telephony.Sms TYPE values. */
data class LocalRow(
    val id: Long,
    val address: String,
    val body: String,
    val date: Long,
    val type: Int,
    val read: Boolean,
    val subId: Int,
)

/**
 * BantAI's own copy of messages Android wouldn't let it store in the phone's
 * SMS database. As the default SMS app BantAI must store every message itself,
 * but Android can leave the WRITE_SMS app-op at "ignore" after the default-SMS
 * role changes hands (seen on a Galaxy S24 FE and a Huawei), and then every
 * write is silently dropped -- incoming texts included. SmsRepository merges
 * these rows into every query, so they appear like any other message.
 *
 * Also records "read" marks and permanent deletes Android refused for real
 * SMS rows, so an unread dot clears and a deleted message stays deleted.
 *
 * Backed by Room; every call is blocking and must run off the main thread
 * (SmsRepository's callers already do).
 */
class LocalMessageStore private constructor(
    private val db: BantaiDatabase,
) {
    private val messages = db.localMessages()
    private val overrides = db.overrides()
    private var nextId: Long? = null

    fun rows(): List<LocalRow> = messages.all().map { it.toRow() }

    fun readOverrides(): Set<Long> = overrides.ids(MessageOverrideEntity.READ).toSet()

    /** Real SMS rows the user deleted for good but Android wouldn't remove. */
    fun deletedOverrides(): Set<Long> = overrides.ids(MessageOverrideEntity.DELETED).toSet()

    @Suppress("LongParameterList")
    fun insert(
        address: String,
        body: String,
        date: Long,
        type: Int,
        read: Boolean,
        subId: Int,
    ): Long {
        val id = takeId()
        messages.insert(LocalMessageEntity(id, address, body, date, type, read, subId))
        return id
    }

    fun updateType(
        id: Long,
        type: Int,
    ): Boolean = messages.updateType(id, type) > 0

    /** Local rows become read; real SMS ids Android wouldn't update are remembered as read. */
    fun markRead(ids: Collection<Long>) {
        if (ids.isEmpty()) return
        db.runInTransaction {
            ids.filter { it < 0 }.chunked(IN_CLAUSE_CHUNK_SIZE).forEach(messages::markRead)
            overrides.insertAll(ids.filter { it > 0 }.map { MessageOverrideEntity(it, MessageOverrideEntity.READ) })
        }
    }

    /** Removes local rows; real SMS ids Android wouldn't delete are hidden instead. */
    fun delete(ids: Collection<Long>) {
        if (ids.isEmpty()) return
        db.runInTransaction {
            ids.filter { it < 0 }.chunked(IN_CLAUSE_CHUNK_SIZE).forEach(messages::delete)
            overrides.insertAll(ids.filter { it > 0 }.map { MessageOverrideEntity(it, MessageOverrideEntity.DELETED) })
        }
    }

    @Synchronized
    private fun takeId(): Long {
        val current =
            nextId ?: run {
                val fresh = -System.currentTimeMillis() * LOCAL_ID_SPACING
                val lowest = messages.minId()
                if (lowest != null && lowest <= fresh) lowest - 1 else fresh
            }
        nextId = current - 1
        return current
    }

    private fun LocalMessageEntity.toRow() = LocalRow(id, address, body, date, type, read, subId)

    companion object {
        @Volatile private var instance: LocalMessageStore? = null

        fun get(context: Context): LocalMessageStore =
            instance ?: synchronized(this) {
                instance ?: LocalMessageStore(BantaiDatabase.get(context)).also { instance = it }
            }
    }
}
