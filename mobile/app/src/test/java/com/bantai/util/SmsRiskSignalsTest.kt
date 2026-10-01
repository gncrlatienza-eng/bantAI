package com.bantai.util

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SmsRiskSignalsTest {
    // Wording taken from real PH telco / e-wallet broadcasts that the old
    // keyword-only rule flagged as suspicious.
    private val legit =
        listOf(
            "Congratulations! Your account has been fully verified. You can now use Send Money, Online " +
                "Cash-in, and more.",
            "Congratulations! May FREE P20 Online Voucher ka when you spend at least P300. Visit your " +
                "voucher pocket to claim your free voucher.",
            "Claim your FREEBIE of 1GB for surfing valid for 7 days now! Simply load a total of P90 before 10/16/2025.",
            "Ay, na-click! Beware of messages with links to claim your prize or redeem thousands of Rewards points.",
            "Get FREE 1GB FOR ALL SITES when you register to GoEXTRA99! Access the GlobeOne app at " +
                "https://globeone.onelink.me/abc",
            "Go all-in with GoEXTRA99! Get it via GCash (https://go.gcash.com/app) or GlobeOne app " +
                "(https://glbe.co/app).",
            "Congratulations! You've earned one free raffle entry for the DITO Rewards Raffle Promo. " +
                "Visit https://app.dito.ph/rewards",
            "Your OTP is 482913. Do not share this code with anyone, including GCash employees.",
            "Hi anak, pauwi na ako, bili ka ng tinapay",
        )

    private val scams =
        listOf(
            "Congratulations! You won a P50,000 GCash prize. Claim now at gcash-claim.example",
            "Your GCash account will be suspended. Verify your account now at gcash-verify.com/login",
            "BDO: Unauthorized access detected. Confirm your account at bdo-secure.xyz",
            "Congratulations! Nanalo ka ng P10,000 sa Shopee raffle. I-claim na: bit.ly/shp-prize",
            "LBC: Your parcel is on hold. Pay P25 fee here https://lbc-ph.top/track",
            "Maya: tap here to update your account https://maya-ph.site",
            "Smart: Congratulations you are selected winner of Samsung A15! Claim now smart-promo.click",
        )

    @Test
    fun `legitimate PH brand messages are not flagged`() {
        legit.forEach { assertFalse(it, SmsRiskSignals.looksSuspicious(it)) }
    }

    @Test
    fun `common PH smishing patterns are flagged`() {
        scams.forEach { assertTrue(it, SmsRiskSignals.looksSuspicious(it)) }
    }

    @Test
    fun `a lure phrase without any link is not enough`() {
        assertFalse(SmsRiskSignals.looksSuspicious("Congratulations, you are the winner of our office raffle!"))
    }
}
