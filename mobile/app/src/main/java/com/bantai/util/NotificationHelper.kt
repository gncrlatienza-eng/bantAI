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
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.RemoteInput
import androidx.core.content.ContextCompat
import com.bantai.MainActivity
import com.bantai.R
import com.bantai.data.model.isGroupKey
import com.bantai.data.model.normalizeSenderKey
import com.bantai.data.remote.TipsApi
import com.bantai.receiver.NotificationActionReceiver

@Suppress("TooManyFunctions") // one builder per notification kind
object NotificationHelper {
    private const val TAG = "NotificationHelper"

    /** Intent extra read by MainActivity to deep-link a notification tap to a tab. */
    const val EXTRA_NAVIGATE_TO = "navigate_to"
    const val TARGET_ALERTS = "alerts"
    const val TARGET_MESSAGES = "messages"

    /** Safety tip to open from its notification, and (for a campaign tip) the wave it belongs to. */
    const val EXTRA_TIP_ID = "tip_id"
    const val EXTRA_TIP_WAVE_KEY = "tip_wave_key"

    /** Intent extra read by MainActivity/NavGraph to jump straight into one thread. */
    const val EXTRA_CONVERSATION_SENDER = "conversation_sender"

    /**
     * Tints the notification icon backdrop in the shade: the middle of the app
     * icon's gradient (#6366F1 -> #4338CA), so it reads as the same indigo.
     */
    private val BRAND_INDIGO = 0xFF534FDE.toInt()

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
    private const val TIPS_CHANNEL_ID = "bantai_tips"
    private const val TIPS_CHANNEL_NAME = "Safety tips"

    /** Derives a stable-ish notification id from a sender, same formula used across the app. */
    fun notifIdFor(sender: String): Int = (sender.hashCode() xor (System.currentTimeMillis() ushr 10).toInt()) and Int.MAX_VALUE

    /**
     * One notification per conversation: a new text replaces the previous one
     * instead of stacking another, and it can be cleared when the thread is read.
     */
    fun conversationNotifId(sender: String): Int = ("msg:" + normalizeSenderKey(sender)).hashCode() and Int.MAX_VALUE

    /** One "not sent" notification per conversation, so a late success can take it back. */
    fun failedSendNotifIdFor(sender: String): Int = ("fail:" + normalizeSenderKey(sender)).hashCode() and Int.MAX_VALUE

    fun cancel(
        context: Context,
        notifId: Int,
    ) {
        runCatching { NotificationManagerCompat.from(context).cancel(notifId) }
    }

    /** Clears a conversation's message notification (it was read, in the app or from the shade). */
    fun cancelConversation(
        context: Context,
        sender: String,
    ) = cancel(context, conversationNotifId(sender))

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
        manager.createNotificationChannel(
            NotificationChannel(TIPS_CHANNEL_ID, TIPS_CHANNEL_NAME, NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "New scam warnings and safety tips from the BantAI team"
            },
        )
    }

    /**
     * A safety tip the BantAI team just published. Tapping it opens the tip:
     * in its Scam Wave for a campaign tip ([waveKey]), else in Scam Awareness.
     */
    fun sendSafetyTip(
        context: Context,
        tip: TipsApi.PublishedTip,
        waveKey: String?,
    ) {
        val notifId = ("tip:" + tip.id).hashCode() and Int.MAX_VALUE
        val intent =
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra(EXTRA_TIP_ID, tip.id)
                waveKey?.let { putExtra(EXTRA_TIP_WAVE_KEY, it) }
                putExtra(IntentToken.EXTRA, IntentToken.get(context))
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
                .Builder(context, TIPS_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(BRAND_INDIGO)
                .setContentTitle(tip.title)
                .setContentText(tip.body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(tip.body))
                .setSubText(context.getString(R.string.tip_notification_subtext))
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .build()
        notifySafely(context, notifId, notification)
    }

    /**
     * A scam whose sender BantAI has already blocked. Nothing to decide, so the
     * copy points at the alert as a chance to learn what the scam looked like.
     */
    fun sendScamBlockedNotice(
        context: Context,
        sender: String,
        notifId: Int,
    ) {
        val safe = sanitizeSender(sender)
        val intent =
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                putExtra(EXTRA_NAVIGATE_TO, TARGET_ALERTS)
                putExtra(IntentToken.EXTRA, IntentToken.get(context))
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
                .setContentTitle("Scam blocked — $safe")
                .setContentText("BantAI blocked a scam text. Tap to see what it looked like.")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .build()
        notifySafely(context, notifId, notification)
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
                putExtra(IntentToken.EXTRA, IntentToken.get(context))
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
                putExtra(IntentToken.EXTRA, IntentToken.get(context))
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
                putExtra(IntentToken.EXTRA, IntentToken.get(context))
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
        @Suppress("UNUSED_PARAMETER") notifId: Int,
        // The thread this belongs to: a group's key for a group MMS, else [sender].
        conversationKey: String = sender,
    ) {
        // Already looking at this conversation: it's marked read there, and a
        // notification on top of it was just noise.
        if (ActiveConversation.isOpen(conversationKey)) return
        val id = conversationNotifId(conversationKey)
        val senderName = ContactNames.lookup(context, sender) ?: sanitizeSender(sender)
        val inGroup = isGroupKey(conversationKey)
        // In a group the title is the group and the text says who wrote it.
        val title = if (inGroup) ContactNames.lookup(context, conversationKey) ?: senderName else senderName
        val text = body.replace(Regex("\\s+"), " ").trim().take(120)
        val preview = if (inGroup) "$senderName: $text" else text
        // Opens this conversation, not just the Messages list.
        val intent =
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                putExtra(EXTRA_NAVIGATE_TO, TARGET_MESSAGES)
                putExtra(IntentToken.EXTRA, IntentToken.get(context))
                putExtra(EXTRA_CONVERSATION_SENDER, conversationKey)
            }
        val pendingIntent =
            PendingIntent.getActivity(
                context,
                id,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

        // A public version stands in on the lock screen / when the notification is
        // otherwise not private -- without it, VISIBILITY_PRIVATE just hides the
        // whole notification there, and the app-wide FLAG_SECURE lock-screen
        // protection (MainActivity) would be undone the moment an SMS body
        // (which can be a forwarded OTP) shows up in a heads-up/lock-screen
        // notification instead.
        val publicVersion =
            NotificationCompat
                .Builder(context, MESSAGE_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(BRAND_INDIGO)
                .setContentTitle(title)
                .setContentText("New message")
                .build()

        val builder =
            NotificationCompat
                .Builder(context, MESSAGE_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(BRAND_INDIGO)
                .setContentTitle(title)
                .setContentText(preview)
                .setStyle(NotificationCompat.BigTextStyle().bigText(preview))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setPublicVersion(publicVersion)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .addAction(markReadAction(context, conversationKey, id))
        // Only a real number can be texted back; "GCash" and friends have no reply
        // path, and a group reply has to go out as MMS from the thread.
        if (!inGroup && isValidSmsRecipient(sender)) builder.addAction(replyAction(context, sender, id))

        notifySafely(context, id, builder.build())
    }

    private fun markReadAction(
        context: Context,
        sender: String,
        requestCode: Int,
    ): NotificationCompat.Action {
        val intent =
            Intent(context, NotificationActionReceiver::class.java)
                .setAction(NotificationActionReceiver.ACTION_MARK_READ)
                .putExtra(NotificationActionReceiver.EXTRA_SENDER, sender)
        val pending =
            PendingIntent.getBroadcast(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        return NotificationCompat.Action
            .Builder(0, "Mark as read", pending)
            .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_MARK_AS_READ)
            .setShowsUserInterface(false)
            .build()
    }

    private fun replyAction(
        context: Context,
        sender: String,
        requestCode: Int,
    ): NotificationCompat.Action {
        val intent =
            Intent(context, NotificationActionReceiver::class.java)
                .setAction(NotificationActionReceiver.ACTION_REPLY)
                .putExtra(NotificationActionReceiver.EXTRA_SENDER, sender)
        // Mutable: the system writes the typed reply into this intent. The
        // intent is explicit (our own receiver), so it can't be redirected.
        val flags =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
        val pending = PendingIntent.getBroadcast(context, requestCode + 1, intent, flags)
        val remoteInput =
            RemoteInput
                .Builder(NotificationActionReceiver.KEY_REPLY_TEXT)
                .setLabel("Reply")
                .build()
        return NotificationCompat.Action
            .Builder(0, "Reply", pending)
            .addRemoteInput(remoteInput)
            .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY)
            .setShowsUserInterface(false)
            .build()
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
                putExtra(IntentToken.EXTRA, IntentToken.get(context))
                putExtra(EXTRA_CONVERSATION_SENDER, sender)
            }
        val pendingIntent =
            PendingIntent.getActivity(
                context,
                notifId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

        // See sendMessageNotification's comment -- same lock-screen leak risk,
        // since the failed body is quoted in full here too.
        val publicVersion =
            NotificationCompat
                .Builder(context, SEND_STATUS_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(BRAND_INDIGO)
                .setContentTitle("Message not sent")
                .setContentText("To $safe")
                .build()

        val notification =
            NotificationCompat
                .Builder(context, SEND_STATUS_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(BRAND_INDIGO)
                .setContentTitle("Message not sent")
                .setContentText("To $safe: $preview")
                .setStyle(NotificationCompat.BigTextStyle().bigText("Your message to $safe could not be sent: $preview"))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setPublicVersion(publicVersion)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .build()

        notifySafely(context, notifId, notification)
    }

    /**
     * An MMS couldn't be downloaded (usually no mobile data). The message is
     * still on the carrier's server; opening the thread shows a "Tap to
     * download" bubble that retries (see MmsDownloader).
     */
    fun sendMmsDownloadFailedNotification(
        context: Context,
        sender: String,
    ) {
        val from = ContactNames.lookup(context, sender) ?: sanitizeSender(sender)
        val id = ("mmsfail:" + normalizeSenderKey(sender)).hashCode() and Int.MAX_VALUE
        val intent =
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                putExtra(EXTRA_NAVIGATE_TO, TARGET_MESSAGES)
                putExtra(IntentToken.EXTRA, IntentToken.get(context))
                putExtra(EXTRA_CONVERSATION_SENDER, sender)
            }
        val pendingIntent =
            PendingIntent.getActivity(
                context,
                id,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        val text = "Couldn't download a picture message. Check mobile data, then tap to try again."
        val notification =
            NotificationCompat
                .Builder(context, MESSAGE_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(BRAND_INDIGO)
                .setContentTitle(from)
                .setContentText(text)
                .setStyle(NotificationCompat.BigTextStyle().bigText(text))
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .build()
        notifySafely(context, id, notification)
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
