package com.bantai.util

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.ContactsContract
import android.util.LruCache
import androidx.core.content.ContextCompat
import com.bantai.data.GroupThreads
import com.bantai.data.model.groupThreadIdOf
import com.bantai.data.model.normalizeSenderKey

private const val CACHE_SIZE = 512

/**
 * The saved contact name for a number, so Messages, threads and notifications
 * show "Mama" instead of "+639171234567". Only real phone numbers are looked up
 * (sender IDs like "GCash" are already names). Cached per process, including
 * "no contact" results; call off the main thread (it queries Contacts).
 */
object ContactNames {
    private val cache = LruCache<String, Result>(CACHE_SIZE)

    private data class Result(
        val name: String?,
    )

    @Suppress("ReturnCount") // group, not a phone number, no permission, cached, or looked up
    fun lookup(
        context: Context,
        address: String,
    ): String? {
        // A group's "name" is its members' names (see GroupThreads).
        groupThreadIdOf(address)?.let { return GroupThreads.title(context, it) }
        if (replyKindFor(address) != SenderReplyKind.PHONE_NUMBER) return null
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return null
        }
        val key = normalizeSenderKey(address)
        cache.get(key)?.let { return it.name }
        val name =
            runCatching {
                context.contentResolver
                    .query(
                        Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(address)),
                        arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME),
                        null,
                        null,
                        null,
                    )?.use { if (it.moveToFirst()) it.getString(0) else null }
            }.getOrNull()?.takeIf { it.isNotBlank() }
        cache.put(key, Result(name))
        return name
    }

    /** After the user edits contacts, names should refresh. */
    fun clear() = cache.evictAll()
}
