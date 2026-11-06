package com.bantai.data

import com.bantai.data.remote.TipsApi
import org.junit.Assert.assertEquals
import org.junit.Test

class PublishedTipsTest {
    private fun tip(
        id: String,
        campaign: String?,
    ) = TipsApi.PublishedTip(id, "Title $id", "Body", campaign, "2026-10-03T00:00:00Z")

    private val tips =
        listOf(
            tip("general", null),
            tip("category", "rewards / prize claim"),
            tip("friendly", "  Fake prizes & rewards "),
            tip("id", "c0ffee"),
            tip("other", "Bank phishing"),
        )

    @Test
    fun `general tips are the ones without a campaign`() {
        assertEquals(listOf("general"), PublishedTips.general(tips).map { it.id })
    }

    @Test
    fun `a wave matches its id, category, friendly name or title, ignoring case`() {
        val matched =
            PublishedTips.forWave(
                tips,
                listOf("c0ffee", "Rewards / prize claim", "Fake prizes & rewards", "Rewards / prize claim (GCash)"),
            )
        assertEquals(listOf("category", "friendly", "id"), matched.map { it.id })
    }

    @Test
    fun `a wave formed only on this phone matches by category alone`() {
        val waveNames = listOf("Bank phishing", "Fake bank texts", "Texts with similar wording")
        val matched = PublishedTips.forWave(tips, waveNames)
        assertEquals(listOf("other"), matched.map { it.id })
    }
}
