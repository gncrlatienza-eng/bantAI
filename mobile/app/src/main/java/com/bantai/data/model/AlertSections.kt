package com.bantai.data.model

import com.bantai.data.remote.SmsApi
import com.bantai.util.TrustedSenders
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * Two different things arrive in Alerts:
 * - [BLOCKED]: a scam whose sender is actually blocked -- a record to learn
 *   from, nothing to decide.
 * - [NEEDS_REVIEW]: something suspicious BantAI did *not* block -- a
 *   "suspicious" verdict, scam-like text from a trusted sender (never
 *   auto-blocked, see TrustedSenders), or a scam whose sender isn't blocked
 *   (the user unblocked it, or the block didn't land). These need the user's eyes.
 */
enum class AlertKind { NEEDS_REVIEW, BLOCKED }

/** The model called it a scam -- whether or not its sender ended up blocked. */
fun SmsApi.AlertSummary.isScamVerdict(): Boolean = bucket == "blocked" || label == "Likely Smishing"

fun SmsApi.AlertSummary.kind(): AlertKind =
    if (isScamVerdict() && senderBlocked && !TrustedSenders.isBuiltIn(sender)) {
        AlertKind.BLOCKED
    } else {
        AlertKind.NEEDS_REVIEW
    }

/**
 * The Alerts tab's three pages. Every alert is on exactly one, so nothing
 * appears twice and each page means one thing:
 * - [TO_REVIEW]: suspicious texts BantAI didn't block -- these need a decision.
 * - [REPORTED]: texts the user reported (Ham/Spam/Scam), with where the review
 *   stands. Reporting *is* reviewing: it files the text under the chosen label
 *   and moves the alert here. Takes priority: once reported, nothing is left to decide.
 * - [BLOCKED]: scams whose sender BantAI blocked -- a record, nothing to do.
 *
 * There used to be a separate "Reviewed" page fed by a "Mark as reviewed"
 * button/swipe; it duplicated what a report already says, so it's gone.
 */
enum class AlertTab {
    // Declaration order is the chip order: what needs you first, then what
    // you've dealt with, then what BantAI dealt with on its own.
    TO_REVIEW,
    REPORTED,
    BLOCKED,
}

fun SmsApi.AlertSummary.tab(): AlertTab =
    when {
        report != null -> AlertTab.REPORTED
        kind() == AlertKind.BLOCKED -> AlertTab.BLOCKED
        else -> AlertTab.TO_REVIEW
    }

/**
 * [alerts] with reports filed from this phone ([reported], messageId to
 * label) filled in where the backend's list doesn't have them yet, so a
 * report moves its alert to Reported straight away.
 */
fun withLocalReports(
    alerts: List<SmsApi.AlertSummary>,
    reported: Map<String, String>,
): List<SmsApi.AlertSummary> =
    alerts.map { alert ->
        val label = reported[alert.messageId]
        if (alert.report != null || label == null) {
            alert
        } else {
            alert.copy(report = SmsApi.AlertReport(reportedLabel = label, status = REPORT_PENDING))
        }
    }

const val REPORT_PENDING = "Pending"
const val REPORT_VALIDATED = "Validated"
const val REPORT_REJECTED = "Rejected"

/**
 * The alerts the user hasn't opened yet: what the Alerts tab's count shows.
 * Each page with any of them gets a dot on its chip, so the count always
 * points somewhere. Nothing is new before the store's first load (see
 * AlertStateStore.initializeIfNeeded).
 */
fun unseenAlerts(
    alerts: List<SmsApi.AlertSummary>,
    initialized: Boolean,
    seen: Set<String>,
): List<SmsApi.AlertSummary> = if (!initialized) emptyList() else alerts.filter { it.messageId !in seen }

data class AlertSection(
    val title: String,
    val alerts: List<SmsApi.AlertSummary>,
)

/**
 * The alerts on [tab], newest first, grouped Today / This Week / Earlier.
 * Empty sections are dropped.
 */
fun sectionAlerts(
    alerts: List<SmsApi.AlertSummary>,
    tab: AlertTab,
    today: LocalDate = LocalDate.now(),
    zone: ZoneId = ZoneId.systemDefault(),
): List<AlertSection> {
    // Newest message first. The backend orders alerts by when it created them,
    // which for an inbox scan of old texts isn't when the SMS arrived.
    val onTab = alerts.filter { it.tab() == tab }.sortedByDescending { receivedMillis(it.receivedAt) }
    val byAge = onTab.groupBy { ageBucket(it.receivedAt, today, zone) }
    return AGE_BUCKETS.mapNotNull { bucket -> byAge[bucket]?.let { AlertSection(bucket, it) } }
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
