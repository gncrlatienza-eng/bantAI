package com.bantai.mms

import com.bantai.data.db.PendingMmsEntity
import com.bantai.data.model.MmsDownloadState
import org.junit.Assert.assertEquals
import org.junit.Test

class MmsDownloaderStateTest {
    private val now = 1_800_000_000_000L
    private val minute = 60_000L

    private fun row(
        state: String,
        attemptedAt: Long = now,
        expiresAt: Long = 0,
    ) = PendingMmsEntity(
        id = 1,
        contentLocation = "http://mmsc/1",
        transactionId = "t1",
        sender = "+639171111111",
        subId = 1,
        sizeBytes = 1000,
        expiresAt = expiresAt,
        receivedAt = attemptedAt,
        attemptedAt = attemptedAt,
        state = state,
    )

    @Test
    fun `a fresh download is downloading`() {
        assertEquals(MmsDownloadState.DOWNLOADING, MmsDownloader.effectiveState(row(PendingMmsEntity.DOWNLOADING), now))
    }

    @Test
    fun `a download that never reported back becomes retryable`() {
        val stale = row(PendingMmsEntity.DOWNLOADING, attemptedAt = now - 10 * minute)
        assertEquals(MmsDownloadState.FAILED, MmsDownloader.effectiveState(stale, now))
    }

    @Test
    fun `a failed download past the carrier's expiry is expired`() {
        val expired = row(PendingMmsEntity.FAILED, expiresAt = now - 1)
        assertEquals(MmsDownloadState.EXPIRED, MmsDownloader.effectiveState(expired, now))
        val notYet = row(PendingMmsEntity.FAILED, expiresAt = now + minute)
        assertEquals(MmsDownloadState.FAILED, MmsDownloader.effectiveState(notYet, now))
    }

    @Test
    fun `expiry can be relative seconds or an absolute time`() {
        assertEquals(0L, MmsDownloader.expiryMillis(0, now))
        assertEquals(now + 3 * 24 * 60 * minute, MmsDownloader.expiryMillis(259_200, now))
        assertEquals(1_900_000_000_000L, MmsDownloader.expiryMillis(1_900_000_000, now))
    }
}
