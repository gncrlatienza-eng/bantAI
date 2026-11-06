package com.bantai.data

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.ContactsContract
import android.util.Log
import androidx.core.content.ContextCompat
import com.bantai.container
import com.bantai.data.remote.VerificationApi
import com.bantai.util.normalizePhNumber
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext

private const val TAG = "ContactsSync"
private const val PREFS = "bantai_contacts_sync"
private const val KEY_LAST_SYNC = "last_sync_ms"
private const val KEY_LAST_SESSION = "last_sync_session"
private const val SYNC_INTERVAL_MS = 24L * 60 * 60 * 1000

// SyncContactsDto's @ArrayMaxSize. The backend treats each call as the full
// snapshot, so this is a single call, never batches.
private const val MAX_CONTACTS = 1000

/**
 * Keeps the backend's pseudonymous contact list current (at most once a day),
 * so sender verification can recognise a saved contact and never auto-block
 * it. Only runs when READ_CONTACTS is already granted -- it never asks -- and
 * sends PH mobile numbers only, never names.
 */
object ContactsSync {
    @Suppress("ReturnCount") // no permission, signed out, not due, or unreadable
    suspend fun syncIfDue(
        context: Context,
        force: Boolean = false,
    ) {
        val app = context.applicationContext
        if (ContextCompat.checkSelfPermission(app, Manifest.permission.READ_CONTACTS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        val token =
            app.container.userPreferences.userData
                .first()
                .authToken
        if (token.isEmpty()) return
        val prefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        // Keyed to the session, so signing in (as anyone) syncs right away
        // instead of inheriting the previous account's 24h window.
        val session = token.hashCode().toString()
        val sameSession = prefs.getString(KEY_LAST_SESSION, null) == session
        if (!force && sameSession && now - prefs.getLong(KEY_LAST_SYNC, 0L) < SYNC_INTERVAL_MS) return

        // null = contacts could not be read. Never send an empty list then:
        // the backend treats each sync as the full snapshot and would delete
        // every saved contact, letting them be auto-blocked.
        val phones = withContext(Dispatchers.IO) { readPhoneNumbers(app) } ?: return
        VerificationApi
            .syncContacts(token, phones)
            .onSuccess {
                prefs
                    .edit()
                    .putLong(KEY_LAST_SYNC, now)
                    .putString(KEY_LAST_SESSION, session)
                    .apply()
            }.onFailure { Log.w(TAG, "Contact sync failed; will retry next time", it) }
    }

    private fun readPhoneNumbers(context: Context): List<String>? =
        runCatching {
            context.contentResolver
                .query(
                    ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                    arrayOf(ContactsContract.CommonDataKinds.Phone.NUMBER),
                    null,
                    null,
                    null,
                )?.use { cursor ->
                    val numbers = LinkedHashSet<String>()
                    while (cursor.moveToNext() && numbers.size < MAX_CONTACTS) {
                        cursor.getString(0)?.let(::normalizePhNumber)?.let(numbers::add)
                    }
                    numbers.toList()
                }
        }.getOrElse {
            Log.w(TAG, "Could not read contacts", it)
            null
        }
}
