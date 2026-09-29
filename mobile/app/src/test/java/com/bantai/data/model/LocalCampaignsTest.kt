package com.bantai.data.model

import com.bantai.data.remote.SmsApi
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LocalCampaignsTest {
    private var nextId = 1L

    private fun msg(
        body: String,
        sender: String = "+639170000000",
        match: SmsApi.CampaignMatch? = null,
    ): LocalScamMessage {
        val id = nextId++
        return LocalScamMessage(id = id, sender = sender, body = body, timestamp = id * 1000, match = match)
    }

    private val gcashCampaign = SmsApi.CampaignMatch("k1", "E-wallet phishing (GCash)", "E-wallet phishing")
    private val casinoCampaign = SmsApi.CampaignMatch("k2", "Online gambling / casino", "Online gambling / casino")
    private val promoCampaign = SmsApi.CampaignMatch("k3", "Promo (Globe)", PROMO_CATEGORY)

    @Test
    fun `AI-matched messages are grouped by campaign under their category`() {
        val overview =
            buildLocalCampaigns(
                listOf(
                    msg("a", match = gcashCampaign),
                    msg("b", match = gcashCampaign),
                    msg("c", match = casinoCampaign),
                ),
            )

        assertEquals(listOf("E-wallet phishing", "Online gambling / casino"), overview.sections.map { it.category })
        val gcash = overview.sections[0].campaigns.single()
        assertEquals("k1", gcash.clusterId)
        assertEquals("E-wallet phishing (GCash)", gcash.title)
        assertEquals(2, gcash.messages.size)
        assertEquals(GroupReason.AI_MATCH, gcash.reason)
    }

    @Test
    fun `promo campaigns are hidden but counted`() {
        val overview =
            buildLocalCampaigns(listOf(msg("load promo", match = promoCampaign), msg("x", match = gcashCampaign)))

        assertEquals(1, overview.hiddenPromoCount)
        assertTrue(overview.sections.none { it.category == PROMO_CATEGORY })
    }

    @Test
    fun `unmatched messages sharing a link domain form a local group`() {
        val overview =
            buildLocalCampaigns(
                listOf(
                    msg("Your parcel is on hold. Pay the fee at https://lbc-track.xyz/p/1", sender = "+639171111111"),
                    msg("Final notice: redelivery fee due lbc-track.xyz/p/22", sender = "+639172222222"),
                    msg("Hi, dinner later?"),
                ),
            )

        val group = overview.localGroups.single()
        assertEquals(GroupReason.SAME_LINK, group.reason)
        assertEquals("Same link: lbc-track[.]xyz", group.title)
        assertEquals("Parcel / delivery scam", group.category)
        assertEquals(2, group.senderCount)
        assertEquals(1, overview.unmatched.size)
    }

    @Test
    fun `reworded copies of one blast group by similar wording`() {
        val overview =
            buildLocalCampaigns(
                listOf(
                    msg("Congratulations! You won a P50,000 GCash raffle prize. Claim your prize today"),
                    msg("CONGRATULATIONS you won P30,000 in the GCash raffle! Claim prize now"),
                    msg("Your electricity bill is due tomorrow"),
                ),
            )

        val group = overview.localGroups.single()
        assertEquals(GroupReason.SIMILAR_WORDING, group.reason)
        assertEquals(2, group.messages.size)
        assertEquals("Rewards / prize claim", group.category)
        assertEquals(1, overview.unmatched.size)
    }

    @Test
    fun `a group found on this phone joins the AI's section for its category`() {
        val overview =
            buildLocalCampaigns(
                listOf(
                    msg("GCash advisory: account deactivated", match = gcashCampaign),
                    msg(
                        "Your GCash wallet is temporarily disabled, verify at gcash-help.xyz/a",
                        sender = "+639171111111",
                    ),
                    msg("GCash deactivated! Reactivate at gcash-help.xyz/b", sender = "+639172222222"),
                ),
            )

        val categories = overview.sections.map { it.category }
        assertEquals(categories.distinct(), categories)
        val section = overview.sections.single { it.category == gcashCampaign.category }
        // One AI-matched campaign and one found on this phone, side by side.
        assertEquals(setOf(true, false), section.campaigns.map { it.clusterId != null }.toSet())
    }

    @Test
    fun `a single unrelated scam stays unmatched`() {
        val overview = buildLocalCampaigns(listOf(msg("Loan approved! Easy cash, no collateral")))

        assertTrue(overview.localGroups.isEmpty())
        assertEquals(1, overview.unmatched.size)
    }

    @Test
    fun `run-on sentences are not mistaken for links`() {
        assertEquals(emptyList<String>(), linkDomains("Your account.Click below to verify"))
        assertEquals(listOf("gcash-verify.xyz"), linkDomains("Verify now at gcash-verify.xyz today"))
        assertEquals(listOf("promo.example"), linkDomains("Open https://www.promo.example/x"))
    }

    @Test
    fun `category vote uses whole words only`() {
        assertEquals(null, messageCategory("This is better than before"))
        assertEquals("Online gambling / casino", messageCategory("Deposit now, get 100% bonus at our casino"))
    }

    @Test
    fun `empty input gives an empty overview`() {
        assertTrue(buildLocalCampaigns(emptyList()).isEmpty)
    }
}
