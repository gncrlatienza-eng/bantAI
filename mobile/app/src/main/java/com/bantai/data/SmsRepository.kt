package com.bantai.data

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.Telephony
import android.util.Log
import androidx.core.content.ContextCompat
import com.bantai.container
import com.bantai.data.local.LocalMessageStore
import com.bantai.data.local.LocalRow
import com.bantai.data.model.Classification
import com.bantai.data.model.PendingMmsDownload
import com.bantai.data.model.SendStatus
import com.bantai.data.model.SmsMessage
import com.bantai.data.model.addressVariants
import com.bantai.data.model.groupThreadIdOf
import com.bantai.data.model.normalizeSenderKey
import com.bantai.mms.MmsDownloader

private const val TAG = "SmsRepository"

// SQLite's default host-parameter cap is ~999; chunking a batch IN (...) query/
// delete keeps every call well under that regardless of how many ids are passed.
private const val SQLITE_IN_CLAUSE_CHUNK_SIZE = 900

// Matches the inbox list's 500-row window, so a sender that shows up in a
// list also has those messages in its thread.
private const val CONVERSATION_LIMIT = 500

internal fun <T> Collection<T>.chunkedForSqliteIn(): List<List<T>> = toList().chunked(SQLITE_IN_CLAUSE_CHUNK_SIZE)

/**
 * Reads messages: the SMS database, MMS (MmsReader) and BantAI's own kept
 * messages (LocalMessageStore), merged and labelled. Writes are SmsWriter's;
 * the labelling rules are MessageClassifier's.
 */
class SmsRepository(
    internal val context: Context,
) {
    private val classificationStore = context.container.classificationStore
    private val localStore = LocalMessageStore.get(context)

    fun hasReadSmsPermission(): Boolean = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED

    // Nothing marked a thread read on open — the Messages list kept showing the
    // unread dot after visiting a conversation because the provider's own READ
    // column was never actually updated. WHERE READ=0 keeps this a no-op (0 rows
    // touched) on an already-read thread, so re-marking on every observer refresh
    // can't loop.
    fun markConversationRead(address: String): Int {
        val unread = getConversationBySender(address).filter { !it.isOutgoing && !it.isRead }.map { it.id }
        context.container.smsWriter.markMessagesRead(unread)
        return unread.size
    }

    // Blocking Room read, like the provider queries it sits beside. Room throws
    // on the main thread, so a caller on the wrong thread fails loudly (this used
    // to be runBlocking over DataStore, which deadlocked there instead).
    private fun storedClassifications(): Map<Long, Classification> =
        try {
            classificationStore.snapshot()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to read stored classifications", e)
            emptyMap()
        }

    @Suppress("NestedBlockDepth") // cursor loop plus merged sources
    fun getInboxMessages(limit: Int = Int.MAX_VALUE): List<SmsMessage> {
        if (!hasReadSmsPermission()) return emptyList()
        val messages = mutableListOf<SmsMessage>()
        val stored = storedClassifications()
        val readIds = localStore.readOverrides()
        val hidden = localStore.deletedOverrides()

        try {
            val cursor =
                context.contentResolver.query(
                    Telephony.Sms.Inbox.CONTENT_URI,
                    arrayOf(
                        Telephony.Sms._ID,
                        Telephony.Sms.ADDRESS,
                        Telephony.Sms.BODY,
                        Telephony.Sms.DATE,
                        Telephony.Sms.READ,
                    ),
                    null,
                    null,
                    "${Telephony.Sms.DATE} DESC",
                )

            cursor?.use {
                val idCol = it.getColumnIndexOrThrow(Telephony.Sms._ID)
                val addressCol = it.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
                val bodyCol = it.getColumnIndexOrThrow(Telephony.Sms.BODY)
                val dateCol = it.getColumnIndexOrThrow(Telephony.Sms.DATE)
                val readCol = it.getColumnIndexOrThrow(Telephony.Sms.READ)
                var count = 0

                while (it.moveToNext() && count < limit) {
                    val id = it.getLong(idCol)
                    if (id in hidden) continue
                    count++
                    val sender = it.getString(addressCol) ?: "Unknown"
                    val body = it.getString(bodyCol) ?: ""
                    messages.add(
                        SmsMessage(
                            id = id,
                            sender = sender,
                            body = body,
                            timestamp = it.getLong(dateCol),
                            classification = MessageClassifier.resolve(stored[id], body, sender),
                            isContact = false,
                            isRead = it.getInt(readCol) == 1 || id in readIds,
                        ),
                    )
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "SMS provider query failed", e)
        }
        val local = localRows(stored) { it.type == Telephony.Sms.MESSAGE_TYPE_INBOX }
        val mms = mms(stored, readIds, hidden) { !it.isOutgoing }
        return (messages + local + mms).sortedByDescending { it.timestamp }.take(limit)
    }

    // The phone's MMS (read-only), plus the ones still waiting to be downloaded,
    // with this app's verdicts and read/delete marks applied.
    private fun mms(
        stored: Map<Long, Classification>,
        readIds: Set<Long>,
        hidden: Set<Long>,
        filter: (SmsMessage) -> Boolean,
    ): List<SmsMessage> =
        (MmsReader.all(context) + pendingMms())
            .filter { it.id !in hidden && filter(it) }
            .map { m ->
                if (m.isOutgoing) {
                    m
                } else if (m.mmsDownload != null) {
                    // Nothing downloaded to classify yet; the text is only a label.
                    m
                } else {
                    m.copy(
                        classification = MessageClassifier.resolve(stored[m.id], m.body, m.sender),
                        isRead = m.isRead || m.id in readIds,
                    )
                }
            }

    // MMS the carrier announced but that aren't downloaded yet ("Tap to download").
    private fun pendingMms(): List<SmsMessage> {
        val now = System.currentTimeMillis()
        return context.container.mmsDownloader.all().map { row ->
            SmsMessage(
                id = PENDING_MMS_ID_OFFSET + row.id,
                sender = row.sender,
                body = "[Picture message]",
                timestamp = row.receivedAt,
                classification = Classification.UNVERIFIED,
                // No row to mark read; a failed download is announced by its own notification.
                isRead = true,
                subId = row.subId,
                mmsDownload = PendingMmsDownload(MmsDownloader.effectiveState(row, now), row.sizeBytes),
            )
        }
    }

    // LocalMessageStore rows as messages, newest first.
    private fun localRows(
        stored: Map<Long, Classification>,
        filter: (LocalRow) -> Boolean,
    ): List<SmsMessage> =
        localStore
            .rows()
            .filter(filter)
            .map { row ->
                val outgoing = row.type != Telephony.Sms.MESSAGE_TYPE_INBOX
                SmsMessage(
                    id = row.id,
                    sender = row.address,
                    body = row.body,
                    timestamp = row.date,
                    classification =
                        if (outgoing) {
                            Classification.SAFE
                        } else {
                            MessageClassifier.resolve(
                                stored[row.id],
                                row.body,
                                row.address,
                            )
                        },
                    isOutgoing = outgoing,
                    isRead = row.read || outgoing,
                    sendStatus = if (outgoing) sendStatusFor(row.type) else SendStatus.NONE,
                    subId = row.subId,
                )
            }.sortedByDescending { it.timestamp }

    /**
     * Messages this phone sent (sent, queued or failed), newest first. The
     * Messages list is otherwise built from the inbox alone, so a
     * conversation the user started with Compose -- which has no received
     * message yet -- never appeared and couldn't be opened again.
     */
    @Suppress("NestedBlockDepth", "LoopWithTooManyJumpStatements") // cursor loop that skips unusable rows
    fun getSentMessages(limit: Int = Int.MAX_VALUE): List<SmsMessage> {
        if (!hasReadSmsPermission()) return emptyList()
        val messages = mutableListOf<SmsMessage>()
        try {
            context.contentResolver
                .query(
                    Telephony.Sms.CONTENT_URI,
                    arrayOf(Telephony.Sms._ID, Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE),
                    "${Telephony.Sms.TYPE} != ?",
                    arrayOf(Telephony.Sms.MESSAGE_TYPE_INBOX.toString()),
                    "${Telephony.Sms.DATE} DESC",
                )?.use {
                    val idCol = it.getColumnIndexOrThrow(Telephony.Sms._ID)
                    val addressCol = it.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
                    val bodyCol = it.getColumnIndexOrThrow(Telephony.Sms.BODY)
                    val dateCol = it.getColumnIndexOrThrow(Telephony.Sms.DATE)
                    val hidden = localStore.deletedOverrides()
                    while (it.moveToNext() && messages.size < limit) {
                        val address = it.getString(addressCol) ?: continue
                        if (it.getLong(idCol) in hidden) continue
                        messages.add(
                            SmsMessage(
                                id = it.getLong(idCol),
                                sender = address,
                                body = it.getString(bodyCol) ?: "",
                                timestamp = it.getLong(dateCol),
                                classification = Classification.SAFE,
                                isContact = false,
                                isRead = true,
                                isOutgoing = true,
                            ),
                        )
                    }
                }
        } catch (e: Exception) {
            Log.e(TAG, "SMS provider query failed", e)
        }
        val local = localRows(emptyMap()) { it.type != Telephony.Sms.MESSAGE_TYPE_INBOX }
        val mms = mms(emptyMap(), emptySet(), localStore.deletedOverrides()) { it.isOutgoing }
        return (messages + local + mms).sortedByDescending { it.timestamp }.take(limit)
    }

    fun getMessageById(id: Long): SmsMessage? {
        if (!hasReadSmsPermission()) return null
        if (id < 0) return localRows(storedClassifications()) { it.id == id }.firstOrNull()
        if (isMmsId(id)) return mms(storedClassifications(), emptySet(), emptySet()) { it.id == id }.firstOrNull()
        try {
            val cursor =
                context.contentResolver.query(
                    Telephony.Sms.CONTENT_URI,
                    arrayOf(Telephony.Sms._ID, Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE),
                    "${Telephony.Sms._ID} = ?",
                    arrayOf(id.toString()),
                    null,
                )
            cursor?.use {
                if (it.moveToFirst()) {
                    val sender = it.getString(it.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)) ?: "Unknown"
                    val body = it.getString(it.getColumnIndexOrThrow(Telephony.Sms.BODY)) ?: ""
                    return SmsMessage(
                        id = it.getLong(it.getColumnIndexOrThrow(Telephony.Sms._ID)),
                        sender = sender,
                        body = body,
                        timestamp = it.getLong(it.getColumnIndexOrThrow(Telephony.Sms.DATE)),
                        classification = MessageClassifier.resolve(storedClassifications()[id], body, sender),
                    )
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "SMS provider query failed", e)
        }
        return null
    }

    private fun sendStatusFor(type: Int): SendStatus =
        when (type) {
            Telephony.Sms.MESSAGE_TYPE_OUTBOX, Telephony.Sms.MESSAGE_TYPE_QUEUED -> SendStatus.SENDING
            Telephony.Sms.MESSAGE_TYPE_FAILED -> SendStatus.FAILED
            Telephony.Sms.MESSAGE_TYPE_SENT -> SendStatus.SENT
            else -> SendStatus.NONE
        }

    // One query merging SMS, MMS and locally kept rows.
    @Suppress("LongMethod", "CyclomaticComplexMethod", "NestedBlockDepth")
    fun getConversationBySender(
        address: String,
        limit: Int = CONVERSATION_LIMIT,
    ): List<SmsMessage> {
        if (!hasReadSmsPermission()) return emptyList()
        groupThreadIdOf(address)?.let { return groupConversation(it, limit) }
        val messages = mutableListOf<SmsMessage>()
        val stored = storedClassifications()
        val variants = addressVariants(address)
        val readIds = localStore.readOverrides()
        val hidden = localStore.deletedOverrides()
        try {
            val cursor =
                context.contentResolver.query(
                    Telephony.Sms.CONTENT_URI,
                    arrayOf(
                        Telephony.Sms._ID,
                        Telephony.Sms.ADDRESS,
                        Telephony.Sms.BODY,
                        Telephony.Sms.DATE,
                        Telephony.Sms.TYPE,
                        Telephony.Sms.READ,
                        Telephony.Sms.SUBSCRIPTION_ID,
                        Telephony.Sms.STATUS,
                    ),
                    // Every spelling of this person's number ("+639...", "09...",
                    // "639..."): matching the exact address split one person into
                    // two conversations whenever the formats differed.
                    "${Telephony.Sms.ADDRESS} IN (${variants.joinToString(",") { "?" }})",
                    variants.toTypedArray(),
                    // Newest first, so the cap keeps the latest messages. It used
                    // to be oldest-first: a sender with more than [limit] texts
                    // (8080 has 440) only ever loaded its oldest ones, so the
                    // spam that put it in the Spam tab never appeared in the
                    // thread's "spam only" view.
                    "${Telephony.Sms.DATE} DESC",
                )
            cursor?.use {
                val idCol = it.getColumnIndexOrThrow(Telephony.Sms._ID)
                val addressCol = it.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
                val bodyCol = it.getColumnIndexOrThrow(Telephony.Sms.BODY)
                val dateCol = it.getColumnIndexOrThrow(Telephony.Sms.DATE)
                val typeCol = it.getColumnIndexOrThrow(Telephony.Sms.TYPE)
                val readCol = it.getColumnIndexOrThrow(Telephony.Sms.READ)
                val subCol = it.getColumnIndex(Telephony.Sms.SUBSCRIPTION_ID)
                val statusCol = it.getColumnIndex(Telephony.Sms.STATUS)
                var count = 0
                while (it.moveToNext() && count < limit) {
                    val id = it.getLong(idCol)
                    if (id in hidden) continue
                    count++
                    val sender = it.getString(addressCol) ?: address
                    val body = it.getString(bodyCol) ?: ""
                    val type = it.getInt(typeCol)
                    val isOutgoing = type != Telephony.Sms.MESSAGE_TYPE_INBOX
                    messages.add(
                        SmsMessage(
                            id = id,
                            sender = sender,
                            body = body,
                            timestamp = it.getLong(dateCol),
                            classification =
                                if (isOutgoing) {
                                    Classification.SAFE
                                } else {
                                    MessageClassifier.resolve(stored[id], body, sender)
                                },
                            isOutgoing = isOutgoing,
                            isRead = isOutgoing || it.getInt(readCol) == 1 || id in readIds,
                            sendStatus = if (isOutgoing) sendStatusFor(type) else SendStatus.NONE,
                            subId = if (subCol >= 0) it.getInt(subCol) else -1,
                            delivered =
                                isOutgoing && statusCol >= 0 && it.getInt(statusCol) == Telephony.Sms.STATUS_COMPLETE,
                        ),
                    )
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "SMS provider query failed", e)
        }
        val key = normalizeSenderKey(address)
        messages += localRows(stored) { normalizeSenderKey(it.address) == key }
        // A group MMS from this person belongs to the group's thread, not theirs.
        messages += mms(stored, readIds, hidden) { it.groupThreadId == null && normalizeSenderKey(it.sender) == key }
        messages.sortByDescending { it.timestamp }
        if (messages.size > limit) messages.subList(limit, messages.size).clear()
        // Blocked messages live exclusively in the Alerts tab, so a thread view
        // must not leak them back in just because the sender also has other,
        // non-blocked messages. Spam is left untouched -- it's still a normal
        // (if hidden-by-default) part of Messages, not an Alerts-only concept.
        // Reversed back to oldest-first for the chat layout.
        return messages.asReversed().filter { it.isOutgoing || it.classification != Classification.SCAM }
    }

    // A group thread holds MMS only (SMS can't have several recipients).
    private fun groupConversation(
        threadId: Long,
        limit: Int,
    ): List<SmsMessage> {
        val messages =
            mms(storedClassifications(), localStore.readOverrides(), localStore.deletedOverrides()) {
                it.groupThreadId == threadId
            }.sortedByDescending { it.timestamp }.take(limit)
        return messages.asReversed().filter { it.isOutgoing || it.classification != Classification.SCAM }
    }

    // Backs the Recently Deleted view — queries the full table (not just Inbox) since
    // a soft-deleted conversation can include the user's own outgoing replies too.
    private fun queryMessagesChunk(
        chunk: List<Long>,
        stored: Map<Long, Classification>,
    ): List<SmsMessage> {
        val messages = mutableListOf<SmsMessage>()
        val placeholders = chunk.joinToString(",") { "?" }
        val cursor =
            context.contentResolver.query(
                Telephony.Sms.CONTENT_URI,
                arrayOf(Telephony.Sms._ID, Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE, Telephony.Sms.TYPE),
                "${Telephony.Sms._ID} IN ($placeholders)",
                chunk.map { it.toString() }.toTypedArray(),
                "${Telephony.Sms.DATE} DESC",
            )
        cursor?.use {
            val idCol = it.getColumnIndexOrThrow(Telephony.Sms._ID)
            val addressCol = it.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
            val bodyCol = it.getColumnIndexOrThrow(Telephony.Sms.BODY)
            val dateCol = it.getColumnIndexOrThrow(Telephony.Sms.DATE)
            val typeCol = it.getColumnIndexOrThrow(Telephony.Sms.TYPE)
            while (it.moveToNext()) {
                val id = it.getLong(idCol)
                val sender = it.getString(addressCol) ?: "Unknown"
                val body = it.getString(bodyCol) ?: ""
                val isOutgoing = it.getInt(typeCol) != Telephony.Sms.MESSAGE_TYPE_INBOX
                messages.add(
                    SmsMessage(
                        id = id,
                        sender = sender,
                        body = body,
                        timestamp = it.getLong(dateCol),
                        classification =
                            if (isOutgoing) {
                                Classification.SAFE
                            } else {
                                MessageClassifier.resolve(stored[id], body, sender)
                            },
                        isOutgoing = isOutgoing,
                    ),
                )
            }
        }
        return messages
    }

    fun getMessagesByIds(ids: Set<Long>): List<SmsMessage> {
        if (!hasReadSmsPermission() || ids.isEmpty()) return emptyList()
        val messages = mutableListOf<SmsMessage>()
        val stored = storedClassifications()
        val (localIds, otherIds) = ids.partition { it < 0 }
        val (mmsIds, providerIds) = otherIds.partition { isMmsId(it) || isPendingMmsId(it) }
        if (mmsIds.isNotEmpty()) {
            val wantedMms = mmsIds.toSet()
            messages += mms(stored, emptySet(), emptySet()) { it.id in wantedMms }
        }
        try {
            for (chunk in providerIds.chunkedForSqliteIn()) {
                messages.addAll(queryMessagesChunk(chunk, stored))
            }
        } catch (e: Exception) {
            Log.e(TAG, "SMS provider query failed", e)
        }
        if (localIds.isNotEmpty()) {
            val wanted = localIds.toSet()
            messages += localRows(stored) { it.id in wanted }
        }
        // Each chunk is independently ordered by DATE DESC; re-sort across chunks
        // so a caller passing >900 ids still gets one globally-ordered result.
        return messages.sortedByDescending { it.timestamp }
    }

    fun getStartTimestamp(period: String): Long {
        val safePeriod =
            when (period) {
                "weekly", "monthly" -> period
                else -> "daily"
            }
        val cal = java.util.Calendar.getInstance()
        cal.set(java.util.Calendar.HOUR_OF_DAY, 0)
        cal.set(java.util.Calendar.MINUTE, 0)
        cal.set(java.util.Calendar.SECOND, 0)
        cal.set(java.util.Calendar.MILLISECOND, 0)
        return when (safePeriod) {
            "weekly" -> {
                cal.set(java.util.Calendar.DAY_OF_WEEK, cal.firstDayOfWeek)
                cal.timeInMillis
            }
            "monthly" -> {
                cal.set(java.util.Calendar.DAY_OF_MONTH, 1)
                cal.timeInMillis
            }
            else -> cal.timeInMillis
        }
    }

    fun getInboxMessagesByPeriod(
        period: String,
        limit: Int = 200,
    ): List<SmsMessage> {
        if (!hasReadSmsPermission()) return emptyList()
        val startTime = getStartTimestamp(period)
        val messages = mutableListOf<SmsMessage>()
        val stored = storedClassifications()
        try {
            val cursor =
                context.contentResolver.query(
                    Telephony.Sms.Inbox.CONTENT_URI,
                    arrayOf(
                        Telephony.Sms._ID,
                        Telephony.Sms.ADDRESS,
                        Telephony.Sms.BODY,
                        Telephony.Sms.DATE,
                        Telephony.Sms.READ,
                    ),
                    "${Telephony.Sms.DATE} >= ?",
                    arrayOf(startTime.toString()),
                    "${Telephony.Sms.DATE} DESC",
                )
            cursor?.use {
                val idCol = it.getColumnIndexOrThrow(Telephony.Sms._ID)
                val addressCol = it.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
                val bodyCol = it.getColumnIndexOrThrow(Telephony.Sms.BODY)
                val dateCol = it.getColumnIndexOrThrow(Telephony.Sms.DATE)
                val readCol = it.getColumnIndexOrThrow(Telephony.Sms.READ)
                var count = 0
                while (it.moveToNext() && count < limit) {
                    count++
                    val id = it.getLong(idCol)
                    val sender = it.getString(addressCol) ?: "Unknown"
                    val body = it.getString(bodyCol) ?: ""
                    messages.add(
                        SmsMessage(
                            id = id,
                            sender = sender,
                            body = body,
                            timestamp = it.getLong(dateCol),
                            classification = MessageClassifier.resolve(stored[id], body, sender),
                            isContact = false,
                            isRead = it.getInt(readCol) == 1,
                        ),
                    )
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "SMS provider query failed", e)
        }
        return messages
    }
}
