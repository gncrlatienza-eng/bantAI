package com.bantai.data

import android.content.Context
import com.bantai.container
import com.bantai.data.model.isScamVerdict
import com.bantai.data.remote.SmsApi
import com.bantai.util.BlockHelper
import com.bantai.util.TrustedSenders
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Fills in [SmsApi.AlertSummary.senderBlocked] for alerts whose sender has
 * already been resolved from the phone's inbox, so Alerts only calls a scam
 * "blocked" when its sender really is.
 *
 * With [catchUp], it first blocks the senders of scam alerts that were never
 * blocked -- scams found by the inbox scan before it auto-blocked (see
 * SmsIngestPipeline.classifyExisting), or blocks that failed at the time.
 * Trusted senders and senders the user unblocked are left alone.
 */
object AlertBlocking {
    suspend fun withBlockStatus(
        context: Context,
        token: String,
        alerts: List<SmsApi.AlertSummary>,
        catchUp: Boolean,
    ): List<SmsApi.AlertSummary> {
        val store = context.container.blockedSendersStore
        if (catchUp) {
            val userUnblocked = store.current().userUnblocked
            val bantaiBlocked = store.current().blocked
            val toBlock =
                withContext(Dispatchers.IO) {
                    alerts
                        .filter { it.isScamVerdict() && it.sender.isNotEmpty() && !TrustedSenders.isBuiltIn(it.sender) }
                        .map { it.sender }
                        .distinct()
                        .filter { it !in userUnblocked && !BlockHelper.isSenderBlocked(context, it, bantaiBlocked) }
                }
            toBlock.forEach { BlockHelper.blockSender(context, token, it) }
        }
        val blocked = store.current().blocked
        return withContext(Dispatchers.IO) {
            alerts.map { it.copy(senderBlocked = BlockHelper.isSenderBlocked(context, it.sender, blocked)) }
        }
    }
}
