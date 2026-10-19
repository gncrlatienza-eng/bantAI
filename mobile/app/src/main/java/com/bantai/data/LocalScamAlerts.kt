package com.bantai.data

import android.content.Context
import com.bantai.container
import com.bantai.data.model.Classification
import com.bantai.data.model.SmsMessage
import com.bantai.data.remote.SmsApi
import com.bantai.util.SmsLinkSafety
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import java.time.Instant

private const val PREFIX = "local:"
private const val ON_DEVICE_SOURCE = "on_device_model_c"

/**
 * Scams the on-device model caught, as Alerts rows. The backend only creates
 * an Alert for a cloud verdict, so before this an on-device Scam had nowhere
 * to go and sat in Review. Testers read that as "the scam wasn't caught".
 *
 * A local row opens the conversation (which carries Report/Block), not the
 * server alert screen, since there is no server alert behind it.
 */
object LocalScamAlerts {
    fun isLocal(messageId: String): Boolean = messageId.startsWith(PREFIX)

    /** Device SMS row id of a local alert, or null for a server one. */
    fun localIdOf(messageId: String): Long? = messageId.takeIf(::isLocal)?.removePrefix(PREFIX)?.toLongOrNull()

    /**
     * On-device Scam verdicts not already shown by a server alert or report
     * ([shownLocalIds]) and not in Recently Deleted.
     */
    suspend fun load(
        context: Context,
        shownLocalIds: Set<Long>,
    ): List<SmsApi.AlertSummary> = withContext(Dispatchers.IO) { loadOnIo(context, shownLocalIds) }

    @Suppress("ReturnCount") // early outs skip the SMS query when nothing qualifies
    private suspend fun loadOnIo(
        context: Context,
        shownLocalIds: Set<Long>,
    ): List<SmsApi.AlertSummary> {
        val container = context.container
        val onDevice = container.classificationStore.idsWithSource(ON_DEVICE_SOURCE)
        if (onDevice.isEmpty()) return emptyList()
        val labels = container.classificationStore.snapshot()
        val deleted =
            container.deletedMessagesStore.deletedEntries
                .first()
                .mapTo(HashSet()) { it.id }
        val ids =
            onDevice
                .filter { labels[it] == Classification.SCAM && it !in shownLocalIds && it !in deleted }
                .toSet()
        if (ids.isEmpty()) return emptyList()
        // getMessagesByIds applies the read-time corrections, so a trusted
        // sender's Scam (read as UNKNOWN) drops out here.
        return container.smsRepository
            .getMessagesByIds(ids)
            .filter { !it.isOutgoing && it.classification == Classification.SCAM }
            .map(::toAlert)
    }

    internal fun toAlert(message: SmsMessage): SmsApi.AlertSummary {
        val at = Instant.ofEpochMilli(message.timestamp).toString()
        return SmsApi.AlertSummary(
            id = "$PREFIX${message.id}",
            status = "Pending",
            createdAt = at,
            messageId = "$PREFIX${message.id}",
            sourceId = null,
            sender = message.sender,
            // A scam: its links and numbers never reach the Alerts preview.
            body = SmsLinkSafety.maskSensitive(message.mms?.text ?: message.body),
            receivedAt = at,
            label = "Scam",
            score = null,
            bucket = "blocked",
            clusterId = null,
            localId = message.id,
        )
    }
}
