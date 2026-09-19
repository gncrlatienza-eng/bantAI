package com.bantai.util

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.bantai.MainActivity
import com.bantai.R

object NotificationHelper {
    private const val TAG = "NotificationHelper"

    /** Intent extra read by MainActivity to deep-link a notification tap to a tab. */
    const val EXTRA_NAVIGATE_TO = "navigate_to"
    const val TARGET_ALERTS = "alerts"
    const val TARGET_MESSAGES = "messages"

    /** Intent extra read by MainActivity/NavGraph to jump straight into one thread. */
    const val EXTRA_CONVERSATION_SENDER = "conversation_sender"

    /** Brand indigo, used to tint the notification icon backdrop in the shade. */
    private val BRAND_INDIGO = 0xFF5B4FE8.toInt()

    private const val SMISHING_CHANNEL_ID = "bantai_smishing"
    private const val SUSPICIOUS_CHANNEL_ID = "bantai_suspicious"
    private const val SPAM_CHANNEL_ID = "bantai_spam"
    private const val MESSAGE_CHANNEL_ID = "bantai_messages"
    private const val SEND_STATUS_CHANNEL_ID = "bantai_send_status"
    private const val SMISHING_CHANNEL_NAME = "Smishing Alerts"
    private const val SUSPICIOUS_CHANNEL_NAME = "Suspicious Alerts"
    private const val SPAM_CHANNEL_NAME = "Spam Alerts"
    private const val MESSAGE_CHANNEL_NAME = "Messages"
    private const val SEND_STATUS_CHANNEL_NAME = "Send Status"

    /** Derives a stable-ish notification id from a sender, same formula used across the app. */
    fun notifIdFor(sender: String): Int = (sender.hashCode() xor (System.currentTimeMillis() ushr 10).toInt()) and Int.MAX_VALUE

    // On API 33+, POST_NOTIFICATIONS is a runtime permission NotificationManager.notify()
    // silently no-ops without — there's no exception to catch, so this must be checked
    // before calling notify() rather than relying on notify() to fail loudly.
    private fun canPostNotifications(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED

    private fun notifySafely(
        context: Context,
        notifId: Int,
        notification: Notification,
    ) {
        if (!canPostNotifications(context)) {
            Log.w(TAG, "Skipped notification $notifId — POST_NOTIFICATIONS not granted")
            return
        }
        context.getSystemService(NotificationManager::class.java).notify(notifId, notification)
    }

    // minSdk is already 26 (O) -- notification channels always exist on a device
    // this app can run on, so no SDK_INT guard is needed here.
    fun createNotificationChannels(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)

        val smishingChannel =
            NotificationChannel(
                SMISHING_CHANNEL_ID,
                SMISHING_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Alerts for detected smishing messages"
                enableVibration(true)
            }

        val suspiciousChannel =
            NotificationChannel(
                SUSPICIOUS_CHANNEL_ID,
                SUSPICIOUS_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = "Alerts for suspicious messages requiring review"
            }

        val spamChannel =
            NotificationChannel(
                SPAM_CHANNEL_ID,
                SPAM_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Unsolicited promotional or marketing messages"
            }

        val messageChannel =
            NotificationChannel(
                MESSAGE_CHANNEL_ID,
                MESSAGE_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Ordinary incoming SMS — BantAI acting as your default messaging app"
            }

        val sendStatusChannel =
            NotificationChannel(
                SEND_STATUS_CHANNEL_ID,
                SEND_STATUS_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Alerts when an outgoing message fails to send"
            }

        manager.createNotificationChannel(smishingChannel)
        manager.createNotificationChannel(suspiciousChannel)
        manager.createNotificationChannel(spamChannel)
        manager.createNotificationChannel(messageChannel)
        manager.createNotificationChannel(sendStatusChannel)
    }

    fun sendSmishingAlert(
        context: Context,
        sender: String,
        notifId: Int,
    ) {
        val safe = sanitizeSender(sender)
        val intent =
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                putExtra(EXTRA_NAVIGATE_TO, TARGET_ALERTS)
            }
        val pendingIntent =
            PendingIntent.getActivity(
                context,
                notifId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

        val notification =
            NotificationCompat
                .Builder(context, SMISHING_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(BRAND_INDIGO)
                .setContentTitle("⚠ Smishing detected — $safe")
                .setContentText("Dangerous link or smishing attempt detected. Review it before blocking the sender.")
                .setStyle(
                    NotificationCompat
                        .BigTextStyle()
                        .bigText(
                            "A high-risk message from $safe was detected. Tap to review and choose what to do.",
                        ),
                ).setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .build()

        notifySafely(context, notifId, notification)
    }

    fun sendSuspiciousAlert(
        context: Context,
        sender: String,
        notifId: Int,
    ) {
        val safe = sanitizeSender(sender)
        val intent =
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                putExtra(EXTRA_NAVIGATE_TO, TARGET_ALERTS)
            }
        val pendingIntent =
            PendingIntent.getActivity(
                context,
                notifId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

        val notification =
            NotificationCompat
                .Builder(context, SUSPICIOUS_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(BRAND_INDIGO)
                .setContentTitle("⚡ Suspicious message — $safe")
                .setContentText("A suspicious message from $safe contains unverified patterns. Review it in BantAI.")
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .build()

        notifySafely(context, notifId, notification)
    }

    /** Unsolicited promotional/ad content — not a threat, so it deep-links to Messages (its Spam chip), not Alerts. */
    fun sendSpamAlert(
        context: Context,
        sender: String,
        notifId: Int,
    ) {
        val safe = sanitizeSender(sender)
        val intent =
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                putExtra(EXTRA_NAVIGATE_TO, TARGET_MESSAGES)
            }
        val pendingIntent =
            PendingIntent.getActivity(
                context,
                notifId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

        val notification =
            NotificationCompat
                .Builder(context, SPAM_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(BRAND_INDIGO)
                .setContentTitle("📢 Spam detected — $safe")
                .setContentText("Promotional or unsolicited message from $safe. Hidden in your Spam folder.")
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .build()

        notifySafely(context, notifId, notification)
    }

    /** Ordinary, non-threatening message — BantAI standing in for a normal texting app. */
    fun sendMessageNotification(
        context: Context,
        sender: String,
        body: String,
        notifId: Int,
    ) {
        val safe = sanitizeSender(sender)
        val preview = body.replace(Regex("\\s+"), " ").trim().take(120)
        val intent =
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                putExtra(EXTRA_NAVIGATE_TO, TARGET_MESSAGES)
            }
        val pendingIntent =
            PendingIntent.getActivity(
                context,
                notifId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

        val notification =
            NotificationCompat
                .Builder(context, MESSAGE_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(BRAND_INDIGO)
                .setContentTitle(safe)
                .setContentText(preview)
                .setStyle(NotificationCompat.BigTextStyle().bigText(preview))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .build()

        notifySafely(context, notifId, notification)
    }

    /**
     * Fires when an outgoing message genuinely fails to send (real carrier/radio
     * result via SmsSender, or its timeout fallback) — every normal messaging app
     * surfaces this in real time rather than leaving it to be discovered by chance
     * inside the thread, since the failure can resolve well after the user has
     * moved on to another screen or backgrounded the app entirely.
     */
    fun sendFailedMessageNotification(
        context: Context,
        sender: String,
        body: String,
        notifId: Int,
    ) {
        val safe = sanitizeSender(sender)
        val preview = body.replace(Regex("\\s+"), " ").trim().take(120)
        val intent =
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                putExtra(EXTRA_NAVIGATE_TO, TARGET_MESSAGES)
                putExtra(EXTRA_CONVERSATION_SENDER, sender)
            }
        val pendingIntent =
            PendingIntent.getActivity(
                context,
                notifId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

        val notification =
            NotificationCompat
                .Builder(context, SEND_STATUS_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(BRAND_INDIGO)
                .setContentTitle("Message not sent")
                .setContentText("To $safe: $preview")
                .setStyle(NotificationCompat.BigTextStyle().bigText("Your message to $safe could not be sent: $preview"))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .build()

        notifySafely(context, notifId, notification)
    }

    // Strip any character that is not a digit, letter, +, -, or space
    // and cap at 30 chars so a crafted sender ID cannot inject arbitrary
    // text into the notification title.
    private fun sanitizeSender(sender: String): String =
        sender
            .filter { it.isLetterOrDigit() || it == '+' || it == '-' || it == ' ' }
            .take(30)
            .trim()
            .ifEmpty { "Unknown" }
}
