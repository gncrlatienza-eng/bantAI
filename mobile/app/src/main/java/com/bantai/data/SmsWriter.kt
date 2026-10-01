package com.bantai.data

import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.provider.Telephony
import android.util.Log
import com.bantai.container
import com.bantai.data.local.LocalMessageStore

private const val TAG = "SmsWriter"

/**
 * Every write to the phone's SMS database: inserting sent/received messages,
 * send-status updates, read marks and permanent deletes. When Android drops a
 * write (WRITE_SMS app-op not allowed), the change is kept in
 * LocalMessageStore instead so it still takes effect. Exceptions are caught
 * broadly on purpose: OEM SMS providers throw SecurityException,
 * SQLiteException, IllegalArgumentException and more.
 */
@Suppress("TooGenericExceptionCaught") // OEM providers throw anything; a failed write must fall back, not crash
class SmsWriter(
    private val context: Context,
) {
    private val localStore = LocalMessageStore.get(context)

    /**
     * Marks exactly [ids] read -- not the sender's whole history, so opening a
     * thread from Spam no longer marks its Messages-side texts read too. When
     * Android drops the update (WRITE_SMS blocked), the read mark is kept
     * locally so the unread dot still clears.
     */
    fun markMessagesRead(ids: Collection<Long>) {
        if (ids.isEmpty()) return
        // A not-yet-downloaded MMS has no row to mark; its bubble stays until it arrives.
        val (localIds, otherIds) = ids.filterNot(::isPendingMmsId).partition { it < 0 }
        val (mmsIds, providerIds) = otherIds.partition(::isMmsId)
        if (mmsIds.isNotEmpty()) {
            MmsReader.markRead(context, mmsIds)
            // Remembered too, in case Android ignores the MMS update as well.
            localStore.markRead(mmsIds)
        }
        var updated = 0
        val values =
            ContentValues().apply {
                put(Telephony.Sms.READ, 1)
                put(Telephony.Sms.SEEN, 1)
            }
        try {
            for (chunk in providerIds.chunkedForSqliteIn()) {
                val placeholders = chunk.joinToString(",") { "?" }
                updated +=
                    context.contentResolver.update(
                        Telephony.Sms.CONTENT_URI,
                        values,
                        "${Telephony.Sms._ID} IN ($placeholders)",
                        chunk.map { it.toString() }.toTypedArray(),
                    )
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to mark messages read", e)
        }
        val remembered = if (updated < providerIds.size) providerIds else emptyList()
        if (localIds.isNotEmpty() || remembered.isNotEmpty()) {
            localStore.markRead(localIds + remembered)
            notifyChanged()
        }
    }

    // SmsManager.sendTextMessage() only transmits the SMS over the network — it does
    // NOT write a local record, even for the default SMS app. Inserted as OUTBOX
    // immediately (before the send result is known) so the UI can show a "Sending…"
    // state right away instead of nothing happening until a network round trip
    // resolves; call updateMessageType() once SmsSender reports success/failure.
    // Returns the inserted row's real id, or null on failure.
    fun insertOutgoingMessage(
        address: String,
        body: String,
        subId: Int = -1,
    ): Long? = insertOwnMessage(address, body, Telephony.Sms.MESSAGE_TYPE_OUTBOX, subId)

    /**
     * Records a sent message after the fact -- the fallback when the OUTBOX row
     * couldn't be written before sending, so a delivered text is never lost.
     */
    fun insertSentMessage(
        address: String,
        body: String,
        subId: Int = -1,
    ): Long? = insertOwnMessage(address, body, Telephony.Sms.MESSAGE_TYPE_SENT, subId)

    // Writes one of this app's own outgoing messages (only the default SMS app
    // may). Two things make it work across phone makers:
    //  - The conversation (THREAD_ID) is resolved up front. AOSP's provider
    //    fills it in by itself, but not every OEM provider does, and a row
    //    without one can be rejected or never grouped into a conversation.
    //  - It goes to the generic sms URI with an explicit TYPE instead of the
    //    outbox URI, which some providers refused.
    // Seen on a Galaxy S24 FE (One UI, Android 16): Compose messages were sent
    // but no row was ever written, so they never showed in Messages. Failures
    // are logged in every build now -- they used to be debug-only and silent.
    private fun insertOwnMessage(
        address: String,
        body: String,
        type: Int,
        subId: Int = -1,
    ): Long? {
        val threadId =
            runCatching { Telephony.Threads.getOrCreateThreadId(context, address) }
                .onFailure { Log.w(TAG, "Couldn't resolve a conversation for an outgoing message", it) }
                .getOrNull()
        val values =
            ContentValues().apply {
                put(Telephony.Sms.ADDRESS, address)
                put(Telephony.Sms.BODY, body)
                put(Telephony.Sms.DATE, System.currentTimeMillis())
                put(Telephony.Sms.READ, 1)
                put(Telephony.Sms.SEEN, 1)
                put(Telephony.Sms.TYPE, type)
                threadId?.let { put(Telephony.Sms.THREAD_ID, it) }
                if (subId >= 0) put(Telephony.Sms.SUBSCRIPTION_ID, subId)
            }
        return insertOrKeep(values, address, body, type, read = true, subId = subId)
    }

    /**
     * Saves an incoming SMS (default SMS app only). Falls back to BantAI's own
     * store when Android drops the write, instead of losing the message.
     */
    @Suppress("LongParameterList")
    fun insertIncomingMessage(
        address: String,
        body: String,
        receivedAt: Long,
        sentAt: Long,
        subId: Int,
    ): Long? {
        val values =
            ContentValues().apply {
                put(Telephony.Sms.ADDRESS, address)
                put(Telephony.Sms.BODY, body)
                put(Telephony.Sms.DATE, receivedAt)
                put(Telephony.Sms.DATE_SENT, sentAt)
                put(Telephony.Sms.READ, 0)
                put(Telephony.Sms.SEEN, 0)
                put(Telephony.Sms.STATUS, Telephony.Sms.STATUS_NONE)
                put(Telephony.Sms.TYPE, Telephony.Sms.MESSAGE_TYPE_INBOX)
                if (subId >= 0) put(Telephony.Sms.SUBSCRIPTION_ID, subId)
            }
        return insertOrKeep(values, address, body, Telephony.Sms.MESSAGE_TYPE_INBOX, read = false, subId = subId)
    }

    // Inserts into the SMS database. With the WRITE_SMS app-op not allowed,
    // Android doesn't throw: it hands back a fake ".../0" URI and writes
    // nothing. That's treated as the failure it is, and the message goes to
    // LocalMessageStore instead (negative id) so it's never lost.
    @Suppress("LongParameterList")
    private fun insertOrKeep(
        values: ContentValues,
        address: String,
        body: String,
        type: Int,
        read: Boolean,
        subId: Int,
    ): Long? {
        val id =
            try {
                val uri = context.contentResolver.insert(Telephony.Sms.CONTENT_URI, values)
                uri?.let { ContentUris.parseId(it) }?.takeIf { it > 0 }.also {
                    if (it == null) Log.w(TAG, "SMS database didn't store a message (type $type); keeping it locally")
                }
            } catch (e: Exception) {
                Log.w(TAG, "SMS database refused a message (type $type); keeping it locally", e)
                null
            }
        if (id != null) return id
        val date = values.getAsLong(Telephony.Sms.DATE) ?: System.currentTimeMillis()
        return runCatching { localStore.insert(address, body, date, type, read, subId) }
            .onFailure { Log.e(TAG, "Couldn't keep a message locally either", it) }
            .getOrNull()
            ?.also { notifyChanged() }
    }

    // Local-store changes don't come from the SMS database, so nothing would
    // tell the screens; this pokes the same observers a real change would.
    private fun notifyChanged() {
        runCatching { context.contentResolver.notifyChange(Telephony.Sms.CONTENT_URI, null) }
    }

    /** Records a delivery report (Telephony.Sms.STATUS_*) on a sent message's row. */
    fun updateDeliveryStatus(
        id: Long,
        status: Int,
    ): Boolean {
        if (id <= 0) return false
        val values = ContentValues().apply { put(Telephony.Sms.STATUS, status) }
        val updated =
            try {
                context.contentResolver.update(
                    Telephony.Sms.CONTENT_URI,
                    values,
                    "${Telephony.Sms._ID} = ?",
                    arrayOf(id.toString()),
                ) > 0
            } catch (e: Exception) {
                Log.e(TAG, "Failed to record delivery status for $id", e)
                false
            }
        if (updated) notifyChanged()
        return updated
    }

    /** Resolves a previously-inserted outgoing message to MESSAGE_TYPE_SENT or MESSAGE_TYPE_FAILED. */
    fun updateMessageType(
        id: Long,
        type: Int,
    ): Boolean {
        if (id < 0) return localStore.updateType(id, type).also { if (it) notifyChanged() }
        val values = ContentValues().apply { put(Telephony.Sms.TYPE, type) }
        return try {
            context.contentResolver.update(
                Telephony.Sms.CONTENT_URI,
                values,
                "${Telephony.Sms._ID} = ?",
                arrayOf(id.toString()),
            ) > 0
        } catch (e: Exception) {
            Log.e(TAG, "Failed to update message $id status", e)
            false
        }
    }

    // Real, irreversible deletion from the phone's actual SMS database. Only the
    // default SMS app may do it, and Android silently deletes 0 rows when the
    // WRITE_SMS app-op is blocked -- callers used to clear Recently Deleted
    // anyway, so the "deleted" messages reappeared. Rows Android keeps are now
    // hidden for good through LocalMessageStore, so a delete always sticks.
    fun deletePermanently(ids: Collection<Long>): Int {
        if (ids.isEmpty()) return 0
        val (pendingIds, rest) = ids.partition(::isPendingMmsId)
        context.container.mmsDownloader.delete(pendingIds.map { it - PENDING_MMS_ID_OFFSET })
        val (localIds, otherIds) = rest.partition { it < 0 }
        val (mmsIds, providerIds) = otherIds.partition(::isMmsId)
        val mmsKept = mmsIds.toSet() - MmsReader.delete(context, mmsIds)
        if (mmsKept.isNotEmpty()) localStore.delete(mmsKept)
        var deleted = 0
        try {
            for (chunk in providerIds.chunkedForSqliteIn()) {
                val placeholders = chunk.joinToString(",") { "?" }
                deleted +=
                    context.contentResolver.delete(
                        Telephony.Sms.CONTENT_URI,
                        "${Telephony.Sms._ID} IN ($placeholders)",
                        chunk.map { it.toString() }.toTypedArray(),
                    )
            }
        } catch (e: Exception) {
            Log.e(TAG, "Permanent delete failed", e)
        }
        val leftBehind = if (deleted < providerIds.size) providerIds else emptyList()
        if (localIds.isNotEmpty() || leftBehind.isNotEmpty()) {
            localStore.delete(localIds + leftBehind)
            notifyChanged()
        }
        return ids.size
    }
}
