package com.bantai.data

import com.bantai.data.model.Classification
import com.bantai.data.model.SmsMessage
import com.bantai.data.remote.SmsApi
import com.bantai.util.SmsLinkSafety
import com.bantai.util.SmsSourceId

// Alerts come from the backend without sender or text (privacy); these fill
// them in from this phone's own messages.

/**
 * Fills in each alert's sender and text from this device's own inbox. The
 * backend deliberately never returns either (privacy placeholder in
 * SmsApi.parseAlert), but `sourceId` resolves to the local SMS row id when
 * this device ingested the message (see SmsSourceId), so the content never
 * has to leave the phone. Alerts with no local row (another device, or a
 * deleted SMS) keep the placeholder.
 */
fun SmsRepository.withLocalContent(alerts: List<SmsApi.AlertSummary>): List<SmsApi.AlertSummary> {
    val resolved = resolveLocal(alerts)
    return resolved.map { (alert, message) -> message?.let { alert.withContent(it) } ?: alert }
}

/**
 * Like [withLocalContent], but drops alerts with no local SMS row instead of
 * keeping the placeholder. Alerts are account-wide, so one flagged on another
 * device (or whose SMS was deleted) otherwise showed as an "Unknown sender"
 * row with no content and no working Block/Report on this phone.
 */
fun SmsRepository.localAlertsOnly(alerts: List<SmsApi.AlertSummary>): List<SmsApi.AlertSummary> {
    val resolved = resolveLocal(alerts)
    // One alert per text on the phone. The backend can hold two messages for
    // the same SMS (a re-scan stored it again), which listed it twice; keep
    // the first alert made for it so its seen/reviewed marks carry over. The
    // backend's order is kept (Settings' preview shows the first few).
    val onPhone = resolved.mapNotNull { (alert, message) -> message?.let { alert to it } }
    // A report may have been filed against either copy; the kept one carries it.
    val reportByMessage =
        onPhone.mapNotNull { (alert, message) -> alert.report?.let { message.id to it } }.toMap()
    val kept =
        onPhone
            .sortedBy { (alert, _) -> alert.createdAt }
            .distinctBy { (_, message) -> message.id }
            .map { (alert, _) -> alert.id }
            .toSet()
    return onPhone
        .filter { (alert, _) -> alert.id in kept }
        .map { (alert, message) ->
            alert.withContent(message).copy(report = alert.report ?: reportByMessage[message.id])
        }
}

private fun SmsRepository.resolveLocal(
    alerts: List<SmsApi.AlertSummary>,
): List<Pair<SmsApi.AlertSummary, SmsMessage?>> {
    val rowIds = alerts.map { SmsSourceId.localRowId(context, it.sourceId) }
    val local = getMessagesByIds(rowIds.filterNotNull().toSet()).associateBy { it.id }
    return alerts.zip(rowIds) { alert, rowId -> alert to rowId?.let(local::get) }
}

// Every alert is a flagged message: links stay hidden, same as a non-safe thread.
private fun SmsApi.AlertSummary.withContent(message: SmsMessage): SmsApi.AlertSummary {
    val safeBody = SmsLinkSafety.visibleBody(message.body, Classification.SCAM)
    return copy(sender = message.sender, body = safeBody, localId = message.id)
}
