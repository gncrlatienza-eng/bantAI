package com.bantai.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.RemoteInput
import com.bantai.container
import com.bantai.data.OutgoingSms
import com.bantai.util.NotificationHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

private const val TAG = "NotificationAction"

/**
 * "Reply" and "Mark as read" on a message notification. Not exported: only
 * BantAI's own notifications (explicit PendingIntents) can reach it.
 */
class NotificationActionReceiver : BroadcastReceiver() {
    @Suppress("TooGenericExceptionCaught") // a failed action must not crash the receiver
    override fun onReceive(
        context: Context,
        intent: Intent,
    ) {
        val sender = intent.getStringExtra(EXTRA_SENDER)?.takeIf { it.isNotBlank() } ?: return
        val appContext = context.applicationContext
        val pendingResult = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                val repo = appContext.container.smsRepository
                when (intent.action) {
                    ACTION_MARK_READ -> repo.markConversationRead(sender)
                    ACTION_REPLY -> {
                        val text =
                            RemoteInput
                                .getResultsFromIntent(intent)
                                ?.getCharSequence(KEY_REPLY_TEXT)
                                ?.toString()
                                ?.trim()
                                .orEmpty()
                        if (text.isNotEmpty()) {
                            // Same SIM the conversation came in on.
                            val subId = repo.getConversationBySender(sender).lastOrNull { !it.isOutgoing }?.subId ?: -1
                            OutgoingSms.send(appContext, sender, text, subId)
                            repo.markConversationRead(sender)
                        }
                    }
                }
                NotificationHelper.cancelConversation(appContext, sender)
            } catch (e: Exception) {
                Log.w(TAG, "Notification action failed", e)
            } finally {
                pendingResult.finish()
            }
        }
    }

    companion object {
        const val ACTION_REPLY = "com.bantai.action.REPLY"
        const val ACTION_MARK_READ = "com.bantai.action.MARK_READ"
        const val EXTRA_SENDER = "com.bantai.extra.SENDER"
        const val KEY_REPLY_TEXT = "com.bantai.key.REPLY_TEXT"
    }
}
