package com.bantai.util

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.bantai.MainActivity
import com.bantai.R

/**
 * The evening recap (DailySummaryWorker): how many scams and spam BantAI
 * caught today, or that the day was clear. Tapping opens DailySummaryScreen.
 * Kept apart from NotificationHelper, which holds the per-message alerts.
 */
object SummaryNotification {
    private const val CHANNEL_ID = "bantai_daily_summary"
    private const val CHANNEL_NAME = "Daily summary"
    private const val NOTIF_ID = 0x5355_4D4D // "SUMM"

    /** False when Android would drop the recap (notifications off, channel muted or missing). */
    fun canPost(context: Context): Boolean {
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return false
        val channel = context.getSystemService(NotificationManager::class.java)?.getNotificationChannel(CHANNEL_ID)
        return channel != null && channel.importance != NotificationManager.IMPORTANCE_NONE
    }

    fun createChannel(manager: NotificationManager) {
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "An evening recap of the scams and spam BantAI caught today"
            },
        )
    }

    fun send(
        context: Context,
        title: String,
        body: String,
    ) {
        val intent =
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra(NotificationHelper.EXTRA_NAVIGATE_TO, NotificationHelper.TARGET_DAILY_SUMMARY)
                putExtra(IntentToken.EXTRA, IntentToken.get(context))
            }
        val pendingIntent =
            PendingIntent.getActivity(
                context,
                NOTIF_ID,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        val notification =
            NotificationCompat
                .Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(NotificationHelper.BRAND_INDIGO)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .build()
        NotificationHelper.notifySafely(context, NOTIF_ID, notification)
    }
}
