package com.bantai.util

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.bantai.MainActivity

object NotificationHelper {

    private const val SMISHING_CHANNEL_ID = "bantai_smishing"
    private const val SUSPICIOUS_CHANNEL_ID = "bantai_suspicious"
    private const val SMISHING_CHANNEL_NAME = "Smishing Alerts"
    private const val SUSPICIOUS_CHANNEL_NAME = "Suspicious Alerts"

    fun createNotificationChannels(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = context.getSystemService(NotificationManager::class.java)

            val smishingChannel = NotificationChannel(
                SMISHING_CHANNEL_ID,
                SMISHING_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Alerts for detected smishing messages"
                enableVibration(true)
            }

            val suspiciousChannel = NotificationChannel(
                SUSPICIOUS_CHANNEL_ID,
                SUSPICIOUS_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = "Alerts for suspicious messages requiring review"
            }

            manager.createNotificationChannel(smishingChannel)
            manager.createNotificationChannel(suspiciousChannel)
        }
    }

    fun sendSmishingAlert(context: Context, sender: String, notifId: Int) {
        val safe = sanitizeSender(sender)
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("navigate_to", "alerts")
        }
        val pendingIntent = PendingIntent.getActivity(
            context, notifId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, SMISHING_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("⚠ Smishing detected — $safe")
            .setContentText("Dangerous link or smishing attempt detected. Sender auto-blocked.")
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText("A smishing message from $safe was detected and the sender has been automatically blocked. Tap to view threat details.")
            )
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        val manager = context.getSystemService(NotificationManager::class.java)
        manager.notify(notifId, notification)
    }

    fun sendSuspiciousAlert(context: Context, sender: String, notifId: Int) {
        val safe = sanitizeSender(sender)
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("navigate_to", "alerts")
        }
        val pendingIntent = PendingIntent.getActivity(
            context, notifId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, SUSPICIOUS_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("⚡ Suspicious message — $safe")
            .setContentText("A suspicious message from $safe contains unverified patterns. Review it in BantAI.")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        val manager = context.getSystemService(NotificationManager::class.java)
        manager.notify(notifId, notification)
    }

    // Strip any character that is not a digit, letter, +, -, or space
    // and cap at 30 chars so a crafted sender ID cannot inject arbitrary
    // text into the notification title.
    private fun sanitizeSender(sender: String): String =
        sender.filter { it.isLetterOrDigit() || it == '+' || it == '-' || it == ' ' }
            .take(30)
            .trim()
            .ifEmpty { "Unknown" }
}
