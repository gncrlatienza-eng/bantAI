package com.bantai.data

import android.content.Context
import android.net.Uri
import android.provider.Telephony
import android.util.Log
import com.bantai.data.db.BantaiDatabase
import com.bantai.data.db.MmsAddressEntity
import com.bantai.data.model.Classification
import com.bantai.data.model.MmsContent
import com.bantai.data.model.SendStatus
import com.bantai.data.model.SmsMessage
import com.bantai.mms.MMS_SEND_TIMEOUT_MS

private const val TAG = "MmsReader"

/**
 * MMS ids share nothing with SMS ids (separate tables), so they're shifted into
 * their own range to stay unique across the app's lists and stores.
 */
const val MMS_ID_OFFSET = 4_000_000_000_000L

/**
 * An MMS the carrier announced but that isn't downloaded yet (a pending_mms
 * row, see MmsDownloader) -- its own range, above the downloaded ones.
 */
const val PENDING_MMS_ID_OFFSET = 5_000_000_000_000L

fun isMmsId(id: Long): Boolean = id >= MMS_ID_OFFSET && id < PENDING_MMS_ID_OFFSET

fun isPendingMmsId(id: Long): Boolean = id >= PENDING_MMS_ID_OFFSET

// PDU address types: who it's from / who it went to.
private const val PDU_FROM = 137
private const val PDU_TO = 151
private const val MILLIS_PER_SECOND = 1000L

// Column positions in the MMS query below.
private const val COL_READ = 3
private const val COL_THREAD = 4
private const val COL_SUB = 5

// Column position of the text in the parts query.
private const val COL_PART_TEXT = 3

/**
 * Read-only access to the phone's MMS (picture messages, group texts, and long
 * texts some carriers convert to MMS). BantAI listed SMS only, so every MMS was
 * invisible -- 361 of them on one test phone. Text parts are the message
 * body, with photos and other attachments labelled for previews; photos are
 * also listed ([MmsContent]) so the thread can show the pictures themselves.
 *
 * The result is cached in memory until the MMS table changes (count or
 * newest id); senders are also remembered across launches (see [addresses]).
 */
object MmsReader {
    private data class Snapshot(
        val count: Int,
        val maxId: Long,
        val messages: List<SmsMessage>,
    )

    @Volatile private var cache: Snapshot? = null

    /** Every MMS on the phone as messages, newest first. */
    @Synchronized
    fun all(context: Context): List<SmsMessage> {
        val resolver = context.contentResolver
        val (count, maxId) =
            runCatching {
                resolver
                    .query(Telephony.Mms.CONTENT_URI, arrayOf("count(*)", "max(_id)"), null, null, null)
                    ?.use { if (it.moveToFirst()) it.getInt(0) to it.getLong(1) else 0 to 0L }
            }.getOrNull() ?: (0 to 0L)
        cache?.let { if (it.count == count && it.maxId == maxId) return it.messages }
        val messages =
            runCatching { readAll(context) }.onFailure { Log.w(TAG, "Couldn't read MMS", it) }.getOrDefault(
                emptyList(),
            )
        cache = Snapshot(count, maxId, messages)
        return messages
    }

    private class Row(
        val id: Long,
        val date: Long,
        val box: Int,
        val read: Boolean,
        val threadId: Long,
        val subId: Int,
    ) {
        val outgoing: Boolean get() = box != Telephony.Mms.MESSAGE_BOX_INBOX
    }

    // Three bulk reads -- the MMS rows, every part, and the senders already
    // remembered in Room -- plus one address query per MMS not seen before.
    // Reading address and parts per MMS took ~5s for 361 MMS on a Huawei P30.
    private fun readAll(context: Context): List<SmsMessage> {
        val rows = mmsRows(context)
        if (rows.isEmpty()) return emptyList()
        val partsById = allParts(context)
        val addresses = addresses(context, rows)
        val groups = GroupThreads.load(context)
        return rows.mapNotNull { row ->
            val address = addresses[row.id] ?: return@mapNotNull null
            val parts = partsById[row.id] ?: Parts(emptyList(), emptyList(), 0)
            SmsMessage(
                id = MMS_ID_OFFSET + row.id,
                sender = address,
                body = parts.previewBody(),
                mms = parts.takeIf { it.images.isNotEmpty() }?.let { MmsContent(it.text, it.images) },
                timestamp = row.date * MILLIS_PER_SECOND,
                classification = if (row.outgoing) Classification.SAFE else Classification.UNVERIFIED,
                isOutgoing = row.outgoing,
                isRead = row.outgoing || row.read,
                sendStatus = sendStatus(row),
                groupThreadId = row.threadId.takeIf { it in groups },
                // Which SIM it used, so a reply in an MMS-only (group) thread goes out on it.
                subId = row.subId,
            )
        }
    }

    private fun mmsRows(context: Context): List<Row> {
        val out = mutableListOf<Row>()
        context.contentResolver
            .query(
                Telephony.Mms.CONTENT_URI,
                arrayOf(
                    Telephony.Mms._ID,
                    Telephony.Mms.DATE,
                    Telephony.Mms.MESSAGE_BOX,
                    Telephony.Mms.READ,
                    Telephony.Mms.THREAD_ID,
                    Telephony.Mms.SUBSCRIPTION_ID,
                ),
                null,
                null,
                "${Telephony.Mms.DATE} DESC",
            )?.use { c ->
                while (c.moveToNext()) {
                    val box = c.getInt(2)
                    if (box !in SHOWN_BOXES) continue
                    out +=
                        Row(
                            id = c.getLong(0),
                            date = c.getLong(1),
                            box = box,
                            read = c.getInt(COL_READ) == 1,
                            threadId = c.getLong(COL_THREAD),
                            subId = if (c.isNull(COL_SUB)) -1 else c.getInt(COL_SUB),
                        )
                }
            }
        return out
    }

    // Received, sent, and BantAI's own sends still going out or failed (see MmsSender).
    private val SHOWN_BOXES =
        setOf(
            Telephony.Mms.MESSAGE_BOX_INBOX,
            Telephony.Mms.MESSAGE_BOX_SENT,
            Telephony.Mms.MESSAGE_BOX_OUTBOX,
            Telephony.Mms.MESSAGE_BOX_FAILED,
        )

    // An outbox row older than MMS_SEND_TIMEOUT_MS is a send that never got an
    // answer (BantAI closed before its own timeout ran): shown as retryable.
    private fun sendStatus(row: Row): SendStatus =
        when (row.box) {
            Telephony.Mms.MESSAGE_BOX_OUTBOX ->
                if (System.currentTimeMillis() - row.date * MILLIS_PER_SECOND > MMS_SEND_TIMEOUT_MS) {
                    SendStatus.FAILED
                } else {
                    SendStatus.SENDING
                }
            Telephony.Mms.MESSAGE_BOX_FAILED -> SendStatus.FAILED
            Telephony.Mms.MESSAGE_BOX_SENT -> SendStatus.SENT
            else -> SendStatus.NONE
        }

    private fun addresses(
        context: Context,
        rows: List<Row>,
    ): Map<Long, String> {
        val dao = BantaiDatabase.get(context).mmsAddresses()
        val known = runCatching { dao.all().associate { it.mmsId to it.address } }.getOrDefault(emptyMap())
        val found =
            rows
                .filter { it.id !in known }
                .mapNotNull { row ->
                    val type = if (row.outgoing) PDU_TO else PDU_FROM
                    address(context, row.id, type)?.let { MmsAddressEntity(row.id, it) }
                }
        if (found.isNotEmpty()) {
            runCatching { dao.insertAll(found) }.onFailure { Log.w(TAG, "Couldn't remember MMS addresses", it) }
        }
        return known + found.associate { it.mmsId to it.address }
    }

    private fun address(
        context: Context,
        mmsId: Long,
        type: Int,
    ): String? =
        context.contentResolver
            .query(
                Uri.parse("content://mms/$mmsId/addr"),
                arrayOf(Telephony.Mms.Addr.ADDRESS),
                "${Telephony.Mms.Addr.TYPE} = ?",
                arrayOf(type.toString()),
                null,
            )?.use { if (it.moveToFirst()) it.getString(0) else null }
            ?.takeIf { it.isNotBlank() && it != "insert-address-token" }

    private class Parts(
        val texts: List<String>,
        val images: List<String>,
        val others: Int,
    ) {
        val text: String get() = texts.joinToString(" ")

        // Text parts joined; anything else becomes a label so a preview isn't empty.
        fun previewBody(): String {
            val labels =
                buildList {
                    if (images.isNotEmpty()) add(if (images.size == 1) "[Photo]" else "[${images.size} photos]")
                    if (others > 0) add("[Attachment]")
                }
            return (texts + labels).joinToString(" ").ifBlank { "[Picture message]" }
        }
    }

    private class PartsBuilder {
        val texts = mutableListOf<String>()
        val images = mutableListOf<String>()
        var others = 0

        fun add(
            partId: Long,
            type: String,
            text: String?,
        ) {
            when {
                type == "text/plain" -> text?.takeIf { it.isNotBlank() }?.let { texts += it }
                type.startsWith("image/") -> images += "content://mms/part/$partId"
                type == "application/smil" -> Unit
                else -> others++
            }
        }

        fun build() = Parts(texts, images, others)
    }

    // Every part on the phone in one query, grouped by the MMS it belongs to.
    private fun allParts(context: Context): Map<Long, Parts> {
        val byMms = mutableMapOf<Long, PartsBuilder>()
        val projection =
            arrayOf(
                Telephony.Mms.Part._ID,
                Telephony.Mms.Part.MSG_ID,
                Telephony.Mms.Part.CONTENT_TYPE,
                Telephony.Mms.Part.TEXT,
            )
        context.contentResolver
            .query(Uri.parse("content://mms/part"), projection, null, null, "${Telephony.Mms.Part.SEQ} ASC")
            ?.use { c ->
                while (c.moveToNext()) {
                    val parts = byMms.getOrPut(c.getLong(1)) { PartsBuilder() }
                    parts.add(c.getLong(0), c.getString(2).orEmpty(), c.getString(COL_PART_TEXT))
                }
            }
        return byMms.mapValues { it.value.build() }
    }

    /**
     * Forgets the cached list. It's only rebuilt when the MMS count or newest id
     * changes, which a send moving from Sending to Sent doesn't do.
     */
    fun invalidate() {
        cache = null
    }

    fun markRead(
        context: Context,
        ids: Collection<Long>,
    ) {
        val raw = ids.filter(::isMmsId).map { it - MMS_ID_OFFSET }
        if (raw.isEmpty()) return
        runCatching {
            val values = android.content.ContentValues().apply { put(Telephony.Mms.READ, 1) }
            context.contentResolver.update(
                Telephony.Mms.CONTENT_URI,
                values,
                "${Telephony.Mms._ID} IN (${raw.joinToString(",") { "?" }})",
                raw.map { it.toString() }.toTypedArray(),
            )
        }.onFailure { Log.w(TAG, "Couldn't mark MMS read", it) }
        cache = null
    }

    /** Deletes MMS for good; returns the ids that were actually removed. */
    fun delete(
        context: Context,
        ids: Collection<Long>,
    ): Set<Long> {
        val deleted = mutableSetOf<Long>()
        for (id in ids.filter(::isMmsId)) {
            val rows =
                runCatching {
                    context.contentResolver.delete(Uri.parse("content://mms/${id - MMS_ID_OFFSET}"), null, null)
                }.getOrDefault(0)
            if (rows > 0) deleted += id
        }
        cache = null
        return deleted
    }
}
