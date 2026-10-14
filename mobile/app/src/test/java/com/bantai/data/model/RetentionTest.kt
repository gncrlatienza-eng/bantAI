package com.bantai.data.model

import com.bantai.data.local.DeletedEntry
import org.junit.Assert.assertEquals
import org.junit.Test

class RetentionTest {
    private val day = 24L * 60 * 60 * 1000
    private val now = 1_000 * day

    @Test
    fun `recently deleted keeps 30 days, then expires`() {
        val entries =
            listOf(
                DeletedEntry(id = 1, deletedAt = now - 29 * day),
                DeletedEntry(id = 2, deletedAt = now - 31 * day),
                DeletedEntry(id = 3, deletedAt = now),
            )
        assertEquals(setOf(2L), Retention.expiredDeletedIds(entries, now))
    }

    @Test
    fun `cutoff counts back whole days`() {
        assertEquals(now - 90 * day, Retention.cutoff(Retention.SCAM_WAVE_DAYS, now))
        assertEquals(now - 30 * day, Retention.cutoff(Retention.BLOCKED_MESSAGES_DAYS, now))
    }
}
