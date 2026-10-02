package com.bantai.data

import android.content.Context
import com.bantai.container
import com.bantai.data.model.isScamVerdict
import com.bantai.data.remote.SmsApi
import com.bantai.data.remote.VerificationApi
import com.bantai.util.BlockHelper
import com.bantai.util.TrustedSenders
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.ConcurrentHashMap

/**
 * Fills in [SmsApi.AlertSummary.senderBlocked] for alerts whose sender has
 * already been resolved from the phone's inbox, so Alerts only calls a scam
 * "blocked" when its sender really is.
 *
 * With [catchUp], it first blocks the senders of scam alerts that were never
 * blocked -- scams found by the inbox scan before it auto-blocked (see
 * SmsIngestPipeline.classifyExisting), or blocks that failed at the time.
 * Only alerts the live path would have blocked qualify ([qualifiesForAutoBlock]).
 * Trusted senders, saved contacts and senders the user unblocked are left
 * alone. Alerts don't carry the registry/contact status, so each candidate is
 * checked with the backend first, and nothing is blocked when that check fails.
 */
object AlertBlocking {
    // Senders the backend said never to auto-block (verified organization or
    // saved contact), kept for the app session so the 20s Alerts poll doesn't
    // look them up again every time.
    private val neverAutoBlock = ConcurrentHashMap.newKeySet<String>()

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
                        .filter { it.qualifiesForAutoBlock() && it.sender.isNotEmpty() }
                        .map { it.sender }
                        .filterNot { TrustedSenders.isBuiltIn(it) }
                        .distinct()
                        .filter {
                            it !in userUnblocked &&
                                it !in neverAutoBlock &&
                                !BlockHelper.isSenderBlocked(context, it, bantaiBlocked)
                        }
                }
            toBlock
                .filter { mayAutoBlock(token, it) }
                .forEach { BlockHelper.blockSender(context, token, it, automatic = true) }
        }
        val blocked = store.current().blocked
        return withContext(Dispatchers.IO) {
            alerts.map { it.copy(senderBlocked = BlockHelper.isSenderBlocked(context, it.sender, blocked)) }
        }
    }

    // Fails closed: a verified organization or saved contact is never
    // auto-blocked (same rule as a live SMS, see TrustedSenders.neverAutoBlock),
    // so an unreachable backend means leave the alert for the user to review.
    private suspend fun mayAutoBlock(
        token: String,
        sender: String,
    ): Boolean {
        // A failed check is not remembered, so it's retried on the next poll.
        val verification = VerificationApi.verifySender(token, sender).getOrNull() ?: return false
        if (TrustedSenders.neverAutoBlock(sender, verification.familiarity)) {
            neverAutoBlock += sender
            return false
        }
        return true
    }

    // Same bar as a live SMS (routeServerClassification): a "blocked" bucket,
    // or a Scam at SCAM_HIGH_CONFIDENCE_THRESHOLD or above. isScamVerdict()
    // alone is any Scam label, which blocked more than the live path does.
    private fun SmsApi.AlertSummary.qualifiesForAutoBlock(): Boolean =
        bucket == "blocked" ||
            (isScamVerdict() && (score ?: 0.0) >= SCAM_HIGH_CONFIDENCE_THRESHOLD)
}
