package com.bantai.data

import android.Manifest
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.provider.Telephony
import android.util.Log
import androidx.core.content.ContextCompat
import com.bantai.BuildConfig
import com.bantai.data.local.ClassificationStore
import com.bantai.data.model.SendStatus
import com.bantai.data.model.SmsMessage
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

private const val TAG = "SmsRepository"

class SmsRepository(
    private val context: Context,
) {
    private val classificationStore = ClassificationStore(context)

    fun hasReadSmsPermission(): Boolean = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED

    // Nothing marked a thread read on open — the Messages list kept showing the
    // unread dot after visiting a conversation because the provider's own READ
    // column was never actually updated. WHERE READ=0 keeps this a no-op (0 rows
    // touched) on an already-read thread, so re-marking on every observer refresh
    // can't loop.
    fun markConversationRead(address: String): Int {
        val values =
            ContentValues().apply {
                put(Telephony.Sms.READ, 1)
                put(Telephony.Sms.SEEN, 1)
            }
        return try {
            context.contentResolver.update(
                Telephony.Sms.Inbox.CONTENT_URI,
                values,
                "${Telephony.Sms.ADDRESS} = ? AND ${Telephony.Sms.READ} = 0",
                arrayOf(address),
            )
        } catch (e: Exception) {
            if (BuildConfig.DEBUG) Log.e(TAG, "Failed to mark conversation with $address read", e)
            0
        }
    }

    // All read methods below are only ever called from a Dispatchers.IO coroutine
    // (every ViewModel in this app loads via viewModelScope.launch(Dispatchers.IO)),
    // so a single blocking DataStore read per query here is cheap and safe — it
    // avoids making every read method in this class suspend just for this lookup.
    private fun storedClassifications(): Map<Long, String> =
        try {
            runBlocking { classificationStore.classifications.first() }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to read stored classifications", e)
            emptyMap()
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
    ): Long? {
        val values =
            ContentValues().apply {
                put(Telephony.Sms.ADDRESS, address)
                put(Telephony.Sms.BODY, body)
                put(Telephony.Sms.DATE, System.currentTimeMillis())
                put(Telephony.Sms.READ, 1)
                put(Telephony.Sms.SEEN, 1)
                put(Telephony.Sms.TYPE, Telephony.Sms.MESSAGE_TYPE_OUTBOX)
            }
        return try {
            val uri = context.contentResolver.insert(Telephony.Sms.Outbox.CONTENT_URI, values)
            uri?.let { ContentUris.parseId(it) }
        } catch (e: Exception) {
            if (BuildConfig.DEBUG) Log.e(TAG, "Failed to record outgoing message to $address", e)
            null
        }
    }

    /** Resolves a previously-inserted outgoing message to MESSAGE_TYPE_SENT or MESSAGE_TYPE_FAILED. */
    fun updateMessageType(
        id: Long,
        type: Int,
    ): Boolean {
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

    fun getInboxMessages(limit: Int = Int.MAX_VALUE): List<SmsMessage> {
        if (!hasReadSmsPermission()) return emptyList()
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
                            classification = stored[id] ?: classifyMessage(body),
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

    fun classifyMessagePublic(body: String): String = classifyMessage(body)

    private fun classifyMessage(body: String): String {
        val bodyLower = body.lowercase()
        // Sender display names are spoofable. A familiar-looking name must
        // never certify a message as safe; verified organizations are assessed
        // server-side alongside the model and can never override fraud evidence.

        // High-confidence scam signals — deliberately excludes words that are routine
        // in legitimate financial messages (otp, verify, account, http, pin, password,
        // confirm, bank, blocked, expire) to prevent false-positive auto-blocking.
        val suspiciousKeywords =
            listOf(
                "click here",
                "tap here",
                "you have won",
                "you won",
                "you are selected",
                "prize",
                "claim your",
                "claim now",
                "congratulations",
                "winner",
                "bit.ly",
                "tinyurl",
                ".xyz",
                ".info",
                ".tk",
                ".top",
                "free gift",
                "cash prize",
                "verify your account",
                "confirm your account",
                "account suspended",
                "account has been suspended",
                "unauthorized access",
                "immediately click",
                "tap to claim",
            )

        val suspiciousScore = suspiciousKeywords.count { bodyLower.contains(it) }

        // Sender IDs are trivially spoofable over SMS -- a scammer only has to
        // include a bank/telco name to match knownSenders. It still shouldn't be
        // auto-blocked outright (a false-positive block on a real OTP/bank alert
        // is disruptive), but the name alone no longer guarantees a clean result
        // when the body itself carries high-confidence scam signals: that
        // combination is surfaced as "unknown" for the user to review instead of
        // being trusted.
        // "blocked" is reserved for a genuine backend AI verdict (Scam winning,
        // >= 0.90, leading the runner-up by >= 0.15 -- see docs/api/classify.md;
        // mobile never re-derives this, it only reads the backend's decision).
        // This on-device heuristic is only a keyword/pattern score, never
        // confident enough to claim that, so its worst outcome is "unknown".
        //
        // Its best outcome is "unverified", not "safe" -- "safe" is reserved for
        // a genuine backend verdict (see SmsIngestPipeline.applyBackendAction).
        // This heuristic only ever runs when the backend couldn't be reached, so
        // "found nothing suspicious" and "the model actually checked this and
        // it's clean" must stay distinguishable in storage and in the UI
        // (Maxene's audit, 2026-09-16) -- collapsing them into one "safe" value
        // is what made them indistinguishable in the first place.
        // A bare phone-number sender used to be flagged "unknown" on format
        // alone (any +63 number, or anything that's just digits/+/-/space),
        // regardless of content -- but real people text from phone numbers,
        // not bank/telco sender IDs, so that caught ordinary "hello" texts
        // from unsaved contacts as often as it caught anything suspicious.
        // Removed 2026-09-16: a plain-number sender now gets the same
        // content-based treatment as a known sender -- suspicious only when
        // the body actually earns it.
        return if (suspiciousScore >= 1) "unknown" else "unverified"
    }

    fun getMessageById(id: Long): SmsMessage? {
        if (!hasReadSmsPermission()) return null
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
                        classification = storedClassifications()[id] ?: classifyMessage(body),
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

    fun getConversationBySender(
        address: String,
        limit: Int = 200,
    ): List<SmsMessage> {
        if (!hasReadSmsPermission()) return emptyList()
        val messages = mutableListOf<SmsMessage>()
        val stored = storedClassifications()
        try {
            val cursor =
                context.contentResolver.query(
                    Telephony.Sms.CONTENT_URI,
                    arrayOf(Telephony.Sms._ID, Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE, Telephony.Sms.TYPE),
                    "${Telephony.Sms.ADDRESS} = ?",
                    arrayOf(address),
                    "${Telephony.Sms.DATE} ASC",
                )
            cursor?.use {
                val idCol = it.getColumnIndexOrThrow(Telephony.Sms._ID)
                val addressCol = it.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
                val bodyCol = it.getColumnIndexOrThrow(Telephony.Sms.BODY)
                val dateCol = it.getColumnIndexOrThrow(Telephony.Sms.DATE)
                val typeCol = it.getColumnIndexOrThrow(Telephony.Sms.TYPE)
                var count = 0
                while (it.moveToNext() && count < limit) {
                    count++
                    val id = it.getLong(idCol)
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
                            classification = if (isOutgoing) "safe" else (stored[id] ?: classifyMessage(body)),
                            isOutgoing = isOutgoing,
                            sendStatus = if (isOutgoing) sendStatusFor(type) else SendStatus.NONE,
                        ),
                    )
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "SMS provider query failed", e)
        }
        // Blocked messages live exclusively in the Alerts tab, so a thread view
        // must not leak them back in just because the sender also has other,
        // non-blocked messages. Spam is left untouched -- it's still a normal
        // (if hidden-by-default) part of Messages, not an Alerts-only concept.
        return messages.filter { it.isOutgoing || it.classification != "blocked" }
    }

    fun getMessagesByClassification(classification: String): List<SmsMessage> = getInboxMessages().filter { it.classification == classification }

    // Backs the Recently Deleted view — queries the full table (not just Inbox) since
    // a soft-deleted conversation can include the user's own outgoing replies too.
    fun getMessagesByIds(ids: Set<Long>): List<SmsMessage> {
        if (!hasReadSmsPermission() || ids.isEmpty()) return emptyList()
        val messages = mutableListOf<SmsMessage>()
        val stored = storedClassifications()
        try {
            val placeholders = ids.joinToString(",") { "?" }
            val cursor =
                context.contentResolver.query(
                    Telephony.Sms.CONTENT_URI,
                    arrayOf(Telephony.Sms._ID, Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE, Telephony.Sms.TYPE),
                    "${Telephony.Sms._ID} IN ($placeholders)",
                    ids.map { it.toString() }.toTypedArray(),
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
                            classification = if (isOutgoing) "safe" else (stored[id] ?: classifyMessage(body)),
                            isOutgoing = isOutgoing,
                        ),
                    )
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "SMS provider query failed", e)
        }
        return messages
    }

    // Real, irreversible deletion from the phone's actual SMS database. Only the
    // default SMS app may call this at all — the OS silently deletes 0 rows otherwise.
    fun deletePermanently(ids: Collection<Long>): Int {
        if (ids.isEmpty()) return 0
        return try {
            val placeholders = ids.joinToString(",") { "?" }
            context.contentResolver.delete(
                Telephony.Sms.CONTENT_URI,
                "${Telephony.Sms._ID} IN ($placeholders)",
                ids.map { it.toString() }.toTypedArray(),
            )
        } catch (e: Exception) {
            Log.e(TAG, "Permanent delete failed", e)
            0
        }
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
                            classification = stored[id] ?: classifyMessage(body),
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
