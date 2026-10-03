package com.bantai.data.model

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDateTime
import java.time.ZoneOffset

class ScanPeriodTest {
    private val zone = ZoneOffset.UTC
    private val now = LocalDateTime.of(2026, 10, 3, 15, 30).toInstant(zone).toEpochMilli()
    private val day = 24L * 60 * 60 * 1000

    @Test
    fun `all scans the whole history`() {
        assertEquals(0L, scanCutoffMillis(SCAN_PERIOD_ALL, now, zone))
    }

    @Test
    fun `today starts at local midnight`() {
        val midnight = LocalDateTime.of(2026, 10, 3, 0, 0).toInstant(zone).toEpochMilli()
        assertEquals(midnight, scanCutoffMillis(SCAN_PERIOD_DAILY, now, zone))
    }

    @Test
    fun `week and month are rolling windows`() {
        assertEquals(now - 7 * day, scanCutoffMillis(SCAN_PERIOD_WEEKLY, now, zone))
        assertEquals(now - 30 * day, scanCutoffMillis(SCAN_PERIOD_MONTHLY, now, zone))
    }

    @Test
    fun `an unknown value scans everything rather than nothing`() {
        assertEquals(0L, scanCutoffMillis("something-else", now, zone))
    }
}
