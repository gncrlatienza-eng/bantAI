package com.bantai.data

import android.content.Context
import android.net.Uri
import android.util.Log
import com.bantai.data.model.groupThreadIdOf
import com.bantai.data.model.groupTitle
import com.bantai.data.model.normalizeSenderKey
import com.bantai.mms.MmsPersister
import com.bantai.util.ContactNames

private const val TAG = "GroupThreads"

// The phone's conversation list (one row per thread) and its address book of
// every number a thread involves. Both are part of the public Telephony
// provider that every SMS app reads; "simple=true" skips the per-thread
// snippet work.
private val THREADS_URI = Uri.parse("content://mms-sms/conversations?simple=true")
private val CANONICAL_ADDRESSES_URI = Uri.parse("content://mms-sms/canonical-addresses")

/**
 * Which phone threads are group conversations, and who is in them. A thread
 * lists its people as ids into the canonical-address table, so the whole phone
 * takes two queries -- reading each MMS's own address rows took ~5s for 361
 * MMS. This phone's own number is left out when it's known (many PH SIMs
 * don't report it).
 */
object GroupThreads {
    @Volatile private var groups: Map<Long, List<String>> = emptyMap()

    /** Reloads every group thread (2+ other people); MmsReader calls this when MMS change. */
    fun load(context: Context): Map<Long, List<String>> {
        val loaded = runCatching { query(context) }.onFailure { Log.w(TAG, "Couldn't read threads", it) }
        return loaded.getOrNull()?.also { groups = it } ?: groups
    }

    /** The other people in a group thread, loading once if it isn't known yet. */
    fun participants(
        context: Context,
        threadId: Long,
    ): List<String> = groups[threadId] ?: load(context)[threadId].orEmpty()

    /** The participants of a group key (see groupKey); empty for a 1:1 key. */
    fun participantsOf(
        context: Context,
        key: String,
    ): List<String> = groupThreadIdOf(key)?.let { participants(context, it) }.orEmpty()

    /** "Ana, Ben and Carl", with contact names where there are any. */
    fun title(
        context: Context,
        threadId: Long,
    ): String = groupTitle(participants(context, threadId).map { ContactNames.lookup(context, it) ?: it })

    private fun query(context: Context): Map<Long, List<String>> {
        val resolver = context.contentResolver
        val recipientIds = mutableMapOf<Long, List<Long>>()
        resolver.query(THREADS_URI, arrayOf("_id", "recipient_ids"), null, null, null)?.use { c ->
            while (c.moveToNext()) {
                val ids =
                    c
                        .getString(1)
                        .orEmpty()
                        .split(' ')
                        .mapNotNull { it.trim().toLongOrNull() }
                if (ids.size > 1) recipientIds[c.getLong(0)] = ids
            }
        }
        if (recipientIds.isEmpty()) return emptyMap()
        val addresses = mutableMapOf<Long, String>()
        resolver.query(CANONICAL_ADDRESSES_URI, arrayOf("_id", "address"), null, null, null)?.use { c ->
            while (c.moveToNext()) c.getString(1)?.let { addresses[c.getLong(0)] = it }
        }
        val self = MmsPersister.selfNumbers(context).map(::normalizeSenderKey).toSet()
        return recipientIds
            .mapValues { (_, ids) ->
                ids
                    .mapNotNull(addresses::get)
                    .filter { normalizeSenderKey(it) !in self }
                    .distinctBy(::normalizeSenderKey)
            }.filterValues { it.size > 1 }
    }
}
