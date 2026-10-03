package com.bantai.data.model

import java.time.Instant
import java.time.ZoneId

/** Settings -> Scan period values, as stored in UserPreferences. */
const val SCAN_PERIOD_ALL = "all"
const val SCAN_PERIOD_DAILY = "daily"
const val SCAN_PERIOD_WEEKLY = "weekly"
const val SCAN_PERIOD_MONTHLY = "monthly"

/** The choices in the order Settings lists them. All is the default: older texts can hold scams too. */
val SCAN_PERIODS = listOf(SCAN_PERIOD_ALL, SCAN_PERIOD_DAILY, SCAN_PERIOD_WEEKLY, SCAN_PERIOD_MONTHLY)

private const val DAY_MS = 24L * 60 * 60 * 1000
private const val WEEK_DAYS = 7
private const val MONTH_DAYS = 30

/**
 * The oldest message timestamp the background AI scan covers for [period]:
 * Today (since local midnight), the last 7 or 30 days, or everything (0).
 * Messages older than this keep the on-device check until the user widens it.
 */
fun scanCutoffMillis(
    period: String,
    now: Long = System.currentTimeMillis(),
    zone: ZoneId = ZoneId.systemDefault(),
): Long =
    when (period) {
        SCAN_PERIOD_DAILY ->
            Instant
                .ofEpochMilli(now)
                .atZone(zone)
                .toLocalDate()
                .atStartOfDay(zone)
                .toInstant()
                .toEpochMilli()
        SCAN_PERIOD_WEEKLY -> now - WEEK_DAYS * DAY_MS
        SCAN_PERIOD_MONTHLY -> now - MONTH_DAYS * DAY_MS
        else -> 0L
    }
