package com.bantai.data

import com.bantai.data.TipNotifications.WaveRef
import com.bantai.data.remote.TipsApi
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class TipNotificationsTest {
    private val now = Instant.parse("2026-10-03T12:00:00Z").toEpochMilli()
    private val hour = 60 * 60 * 1000L

    private fun tip(
        id: String,
        campaign: String? = null,
        ageMs: Long = hour,
    ) = TipsApi.PublishedTip(id, "Title $id", "Body", campaign, Instant.ofEpochMilli(now - ageMs).toString())

    private val prizeWave = WaveRef("ai:k1", listOf("k1", "Rewards / prize claim", "Fake prizes & rewards"))

    @Test
    fun `a new general tip notifies and opens Scam Awareness`() {
        val plan = TipNotifications.plan(listOf(tip("g")), emptySet(), baselined = true, waves = emptyList(), now = now)
        assertEquals(listOf("g" to null), plan.alerts.map { it.tip.id to it.waveKey })
        assertEquals(setOf("g"), plan.markSeen)
    }

    @Test
    fun `a tip already seen is not notified again`() {
        val plan = TipNotifications.plan(listOf(tip("g")), setOf("g"), baselined = true, waves = emptyList(), now = now)
        assertTrue(plan.alerts.isEmpty())
    }

    @Test
    fun `a campaign tip notifies only a phone with that wave, and opens it`() {
        val tips = listOf(tip("c", campaign = "rewards / prize claim"))
        val withWave = TipNotifications.plan(tips, emptySet(), baselined = true, waves = listOf(prizeWave), now = now)
        assertEquals(listOf("c" to "ai:k1"), withWave.alerts.map { it.tip.id to it.waveKey })

        val without = TipNotifications.plan(tips, emptySet(), baselined = true, waves = emptyList(), now = now)
        assertTrue(without.alerts.isEmpty())
        // Not marked seen: notified later if this phone gets that scam.
        assertTrue(without.markSeen.isEmpty())
    }

    @Test
    fun `a campaign tip stops waiting after 30 days`() {
        val old = tip("c", campaign = "Bank phishing", ageMs = TipNotifications.LATE_MATCH_WINDOW_MS + hour)
        val plan = TipNotifications.plan(listOf(old), emptySet(), baselined = true, waves = emptyList(), now = now)
        assertEquals(setOf("c"), plan.markSeen)
    }

    @Test
    fun `the first check only notifies tips from the last day`() {
        val tips = listOf(tip("new"), tip("old", ageMs = 3 * 24 * hour))
        val plan = TipNotifications.plan(tips, emptySet(), baselined = false, waves = emptyList(), now = now)
        assertEquals(listOf("new"), plan.alerts.map { it.tip.id })
        assertEquals(setOf("new", "old"), plan.markSeen)
    }

    @Test
    fun `a burst shows at most three but marks all seen`() {
        val tips = (1..5).map { tip("t$it") }
        val plan = TipNotifications.plan(tips, emptySet(), baselined = true, waves = emptyList(), now = now)
        assertEquals(TipNotifications.MAX_PER_CHECK, plan.alerts.size)
        assertEquals(5, plan.markSeen.size)
    }
}
