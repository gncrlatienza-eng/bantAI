package com.bantai.data.model

import com.bantai.data.remote.SmsApi
import com.bantai.util.TrustedSenders
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * Two different things arrive in Alerts:
 * - [BLOCKED]: a scam BantAI already stopped (its sender was auto-blocked) --
 *   a record to learn from, nothing to decide.
 * - [NEEDS_REVIEW]: something suspicious BantAI did *not* block -- a
 *   "suspicious" verdict, or scam-like text from a trusted sender, which is
 *   never auto-blocked (see TrustedSenders). These need the user's eyes.
 */
enum class AlertKind { NEEDS_REVIEW, BLOCKED }

fun SmsApi.AlertSummary.kind(): AlertKind {
    val scamVerdict = bucket == "blocked" || label == "Likely Smishing"
    return if (scamVerdict && !TrustedSenders.isBuiltIn(sender)) AlertKind.BLOCKED else AlertKind.NEEDS_REVIEW
}

/**
 * Two separate views, never mixed: [ALL] is what BantAI didn't block (what
 * needs review on top, already-reviewed below), [BLOCKED] is only the scams
 * it stopped. Blocked scams need no decision, so they stay out of the way.
 */
enum class AlertFilter(
    val title: String,
) {
    ALL("Alerts"),
    BLOCKED("Blocked"),
}

data class AlertSection(
    val title: String,
    val alerts: List<SmsApi.AlertSummary>,
)

/**
 * Splits the alert list into what the Alerts tab shows under [filter], newest
 * first. [AlertFilter.ALL]: alerts still waiting for review in their own
 * section, then already-reviewed ones grouped Today / This Week / Earlier.
 * [AlertFilter.BLOCKED]: blocked scams grouped the same way. Empty sections
 * are dropped.
 */
fun sectionAlerts(
    alerts: List<SmsApi.AlertSummary>,
    filter: AlertFilter,
    reviewed: Set<String>,
    today: LocalDate = LocalDate.now(),
    zone: ZoneId = ZoneId.systemDefault(),
): List<AlertSection> {
    // Newest message first. The backend orders alerts by when it created them,
    // which for an inbox scan of old texts isn't when the SMS arrived.
    val newestFirst = alerts.sortedByDescending { receivedMillis(it.receivedAt) }
    val visible =
        when (filter) {
            AlertFilter.ALL -> newestFirst.filter { it.kind() == AlertKind.NEEDS_REVIEW }
            AlertFilter.BLOCKED -> newestFirst.filter { it.kind() == AlertKind.BLOCKED }
        }
    val (pending, history) =
        visible.partition { it.kind() == AlertKind.NEEDS_REVIEW && it.messageId !in reviewed }

    val byAge = history.groupBy { ageBucket(it.receivedAt, today, zone) }
    return buildList {
        if (pending.isNotEmpty()) add(AlertSection("Needs Review", pending))
        AGE_BUCKETS.forEach { bucket ->
            byAge[bucket]?.let { add(AlertSection(bucket, it)) }
        }
    }
}

private const val TODAY = "Today"
private const val THIS_WEEK = "This Week"
private const val EARLIER = "Earlier"
private val AGE_BUCKETS = listOf(TODAY, THIS_WEEK, EARLIER)
private const val WEEK_DAYS = 7L

private fun receivedMillis(iso: String): Long =
    try {
        Instant.parse(iso).toEpochMilli()
    } catch (_: Exception) {
        0L
    }

private fun ageBucket(
    iso: String,
    today: LocalDate,
    zone: ZoneId,
): String {
    val date =
        try {
            Instant.parse(iso).atZone(zone).toLocalDate()
        } catch (_: Exception) {
            return EARLIER
        }
    return when {
        date == today -> TODAY
        date.isAfter(today.minusDays(WEEK_DAYS)) -> THIS_WEEK
        else -> EARLIER
    }
}
