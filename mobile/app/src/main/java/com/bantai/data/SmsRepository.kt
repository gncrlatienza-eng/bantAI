package com.bantai.data

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.Telephony
import android.util.Log
import androidx.core.content.ContextCompat
import com.bantai.data.model.SmsMessage

private const val TAG = "SmsRepository"

class SmsRepository(private val context: Context) {

    fun hasReadSmsPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED

    fun getInboxMessages(limit: Int = Int.MAX_VALUE): List<SmsMessage> {
        if (!hasReadSmsPermission()) return emptyList()
        val messages = mutableListOf<SmsMessage>()

        try {
            val cursor = context.contentResolver.query(
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
                    val sender = it.getString(addressCol) ?: "Unknown"
                    val body = it.getString(bodyCol) ?: ""
                    messages.add(
                        SmsMessage(
                            id = it.getLong(idCol),
                            sender = sender,
                            body = body,
                            timestamp = it.getLong(dateCol),
                            classification = classifyMessage(sender, body),
                            isContact = false,
                            isRead = it.getInt(readCol) == 1,
                        )
                    )
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "SMS provider query failed", e)
        }

        return messages
    }

    fun classifyMessagePublic(sender: String, body: String): String {
        return classifyMessage(sender, body)
    }

    private fun classifyMessage(sender: String, body: String): String {
        val bodyLower = body.lowercase()
        val senderLower = sender.lowercase()

        // Guard: known legitimate senders are always safe — never auto-blocked
        val knownSenders = listOf(
            "pldt", "smart", "globe", "dito", "sun", "tnt",
            "sss", "gsis", "philhealth", "pagibig", "bir",
            "meralco", "maynilad", "manila water",
            "jollibee", "mcdo", "grab", "shopee", "lazada",
            // Financial institutions added here so their OTP/notification messages
            // are never misclassified and auto-blocked
            "gcash", "bdo", "maya", "metrobank", "bpi", "unionbank",
            "security bank", "chinabank", "rcbc", "eastwest", "landbank",
        )
        if (knownSenders.any { senderLower.contains(it) }) return "safe"

        // High-confidence scam signals — deliberately excludes words that are routine
        // in legitimate financial messages (otp, verify, account, http, pin, password,
        // confirm, bank, blocked, expire) to prevent false-positive auto-blocking.
        val suspiciousKeywords = listOf(
            "click here", "tap here",
            "you have won", "you won", "you are selected",
            "prize", "claim your", "claim now",
            "congratulations", "winner",
            "bit.ly", "tinyurl", ".xyz", ".info", ".tk", ".top",
            "free gift", "cash prize",
            "verify your account", "confirm your account",
            "account suspended", "account has been suspended",
            "unauthorized access",
            "immediately click", "tap to claim",
        )

        val suspiciousScore = suspiciousKeywords.count { bodyLower.contains(it) }

        return when {
            suspiciousScore >= 2 -> "suspicious"
            suspiciousScore == 1 -> "unknown"
            sender.startsWith("+63") -> "unknown"
            sender.all { it.isDigit() || it == '+' || it == '-' || it == ' ' } -> "unknown"
            else -> "safe"
        }
    }

    fun getBlockedMessages(limit: Int = 100): List<SmsMessage> {
        if (!hasReadSmsPermission()) return emptyList()
        val messages = mutableListOf<SmsMessage>()
        try {
            val cursor = context.contentResolver.query(
                Telephony.Sms.CONTENT_URI,
                arrayOf(Telephony.Sms._ID, Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE),
                "blocked = 1",
                null,
                "${Telephony.Sms.DATE} DESC",
            )
            cursor?.use {
                val idCol = it.getColumnIndexOrThrow(Telephony.Sms._ID)
                val addressCol = it.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
                val bodyCol = it.getColumnIndexOrThrow(Telephony.Sms.BODY)
                val dateCol = it.getColumnIndexOrThrow(Telephony.Sms.DATE)
                var count = 0
                while (it.moveToNext() && count < limit) {
                    count++
                    val sender = it.getString(addressCol) ?: "Unknown"
                    val body = it.getString(bodyCol) ?: ""
                    messages.add(SmsMessage(id = it.getLong(idCol), sender = sender, body = body, timestamp = it.getLong(dateCol), classification = "blocked"))
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "SMS provider query failed", e)
        }
        return messages
    }

    fun getMessageById(id: Long): SmsMessage? {
        if (!hasReadSmsPermission()) return null
        try {
            val cursor = context.contentResolver.query(
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
                        classification = classifyMessage(sender, body),
                    )
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "SMS provider query failed", e)
        }
        return null
    }

    fun getConversationBySender(address: String, limit: Int = 200): List<SmsMessage> {
        if (!hasReadSmsPermission()) return emptyList()
        val messages = mutableListOf<SmsMessage>()
        try {
            val cursor = context.contentResolver.query(
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
                    val sender = it.getString(addressCol) ?: address
                    val body = it.getString(bodyCol) ?: ""
                    val isOutgoing = it.getInt(typeCol) != Telephony.Sms.MESSAGE_TYPE_INBOX
                    messages.add(
                        SmsMessage(
                            id = it.getLong(idCol),
                            sender = sender,
                            body = body,
                            timestamp = it.getLong(dateCol),
                            classification = if (isOutgoing) "safe" else classifyMessage(sender, body),
                            isOutgoing = isOutgoing,
                        )
                    )
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "SMS provider query failed", e)
        }
        return messages
    }

    fun getMessagesByClassification(classification: String): List<SmsMessage> =
        getInboxMessages().filter { it.classification == classification }

    fun getStartTimestamp(period: String): Long {
        val safePeriod = when (period) { "weekly", "monthly" -> period; else -> "daily" }
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

    fun getInboxMessagesByPeriod(period: String, limit: Int = 200): List<SmsMessage> {
        if (!hasReadSmsPermission()) return emptyList()
        val startTime = getStartTimestamp(period)
        val messages = mutableListOf<SmsMessage>()
        try {
            val cursor = context.contentResolver.query(
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
                    val sender = it.getString(addressCol) ?: "Unknown"
                    val body = it.getString(bodyCol) ?: ""
                    messages.add(
                        SmsMessage(
                            id = it.getLong(idCol),
                            sender = sender,
                            body = body,
                            timestamp = it.getLong(dateCol),
                            classification = classifyMessage(sender, body),
                            isContact = false,
                            isRead = it.getInt(readCol) == 1,
                        )
                    )
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "SMS provider query failed", e)
        }
        return messages
    }
}
