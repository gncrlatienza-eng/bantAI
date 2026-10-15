package com.bantai.data

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Duration
import java.time.ZoneId
import java.time.ZonedDateTime

class DailySummaryScheduleTest {
    private val manila = ZoneId.of("Asia/Manila")

    @Test
    fun `later today when the time is still ahead`() {
        val now = ZonedDateTime.of(2026, 10, 14, 18, 30, 0, 0, manila)
        assertEquals(Duration.ofMinutes(90), DailySummaryScheduler.delayUntil(now, 20 * 60))
    }

    @Test
    fun `tomorrow when the time has passed`() {
        val now = ZonedDateTime.of(2026, 10, 14, 21, 0, 0, 0, manila)
        assertEquals(Duration.ofHours(23), DailySummaryScheduler.delayUntil(now, 20 * 60))
    }

    @Test
    fun `exactly now waits a full day`() {
        val now = ZonedDateTime.of(2026, 10, 14, 20, 0, 0, 0, manila)
        assertEquals(Duration.ofDays(1), DailySummaryScheduler.delayUntil(now, 20 * 60))
    }

    @Test
    fun `due after the time, once per day`() {
        val at = ZonedDateTime.of(2026, 10, 14, 20, 5, 0, 0, manila)
        val today = at.toLocalDate().toEpochDay()
        assertEquals(true, DailySummaryScheduler.isDue(at, 20 * 60, today - 1))
        assertEquals(false, DailySummaryScheduler.isDue(at, 20 * 60, today))
        assertEquals(false, DailySummaryScheduler.isDue(at.withHour(19), 20 * 60, today - 1))
    }
}
