package com.bantai.util

import android.content.Context
import com.bantai.R
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

private const val DAYS_SHOWN_AS_WEEKDAY = 6L

/**
 * Real message times, the way messaging apps show them. The app used to show
 * only relative ages ("3d", "2w", "52w" for a year-old thread, "0m" for a
 * brand-new text) and no time of day in the bubbles at all.
 */
object MessageTime {
    private fun localDate(timestamp: Long): LocalDate {
        val zoned = Instant.ofEpochMilli(timestamp).atZone(ZoneId.systemDefault())
        return zoned.toLocalDate()
    }

    private fun daysAgo(timestamp: Long): Long = ChronoUnit.DAYS.between(localDate(timestamp), LocalDate.now())

    private fun format(
        timestamp: Long,
        pattern: String,
    ): String =
        Instant
            .ofEpochMilli(timestamp)
            .atZone(ZoneId.systemDefault())
            .format(DateTimeFormatter.ofPattern(pattern, Locale.getDefault()))

    /** Clock time for a bubble: "2:14 PM". */
    fun clock(timestamp: Long): String = format(timestamp, "h:mm a")

    /** Messages list: "2:14 PM" today, then "Yesterday", "Mon", "Sep 12", "9/12/25". */
    fun listLabel(
        context: Context,
        timestamp: Long,
    ): String {
        val days = daysAgo(timestamp)
        return when {
            days <= 0 -> clock(timestamp)
            days == 1L -> context.getString(R.string.time_yesterday)
            days <= DAYS_SHOWN_AS_WEEKDAY -> format(timestamp, "EEE")
            localDate(timestamp).year == LocalDate.now().year -> format(timestamp, "MMM d")
            else -> format(timestamp, "M/d/yy")
        }
    }

    /** Divider between days in a conversation: "Today", "Yesterday", "Monday", "Sep 12", "Sep 12, 2025". */
    fun dayLabel(
        context: Context,
        timestamp: Long,
    ): String {
        val days = daysAgo(timestamp)
        return when {
            days <= 0 -> context.getString(R.string.time_today)
            days == 1L -> context.getString(R.string.time_yesterday)
            days <= DAYS_SHOWN_AS_WEEKDAY -> format(timestamp, "EEEE")
            localDate(timestamp).year == LocalDate.now().year -> format(timestamp, "EEE, MMM d")
            else -> format(timestamp, "MMM d, yyyy")
        }
    }

    fun sameDay(
        a: Long,
        b: Long,
    ): Boolean = localDate(a) == localDate(b)
}
