package com.bantai.util

import com.bantai.data.model.Classification
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TransactionalMessageTest {
    // Real messages Model C labelled Spam at ~100% on the test phone.
    @Test
    fun `receipts and confirmations are transactional`() {
        listOf(
            "You paid P145.00 via Gcash for your Buy 1 Get 1 Salted Butter Caramel order. Ref No. 1234567890",
            "Hi! You have successfully subscribed to DITO LEVEL-UP 99. You can now enjoy unlimited calls.",
            "You've earned 0.99 DITO Point(s) from your promo purchase using Combo 99.",
            "You have received P500.00 from JUAN D. on 09/29/2026. Your new balance is P1,200.00.",
            "Your OTP is 123456. Do not share it with anyone.",
            "Your cash-in of P1,000 was successful.",
        ).forEach { assertTrue(it, TransactionalMessage.isTransactional(it)) }
    }

    @Test
    fun `promos stay spam`() {
        listOf(
            "Supercharge your surfing experience with Go5G TURBO 50! Enjoy faster speeds and lower prices.",
            "A special offer for you! Get connected for 7 days with SuperGo59. Get your 5GB all-access data.",
            "Limited Time Offer! May P10 bonus ka kapag nag-cash in ng at least P50. Mag-cash in na!",
            "Unveil your most luxurious scent at LOOK At Me and get P300 OFF. Shop now!",
            "You have 2.97 DITO Points that will expire this month! Redeem them in the DITO app.",
        ).forEach { assertFalse(it, TransactionalMessage.isTransactional(it)) }
    }

    @Test
    fun `a receipt-looking message with an unofficial link stays spam`() {
        listOf(
            "You have received P5,000.00. Ref no. 88213. Verify to withdraw: http://gcash-claim.top",
            "Your cash-in of P1,000 was successful. Details: https://203.0.113.7/r",
            "You paid P145.00. Ref No. 12345. View receipt at gcash-receipt.xyz",
        ).forEach {
            assertFalse(it, TransactionalMessage.isTransactional(it))
            assertEquals(it, Classification.SPAM, TransactionalMessage.correct(Classification.SPAM, it))
        }
    }

    @Test
    fun `a receipt linking to an official domain is still transactional`() {
        val receipt = "You paid P145.00 via GCash. Ref No. 12345. Help: https://www.gcash.com/help"
        assertTrue(TransactionalMessage.isTransactional(receipt))
    }

    @Test
    fun `a transactional phrase with a sales pitch stays spam`() {
        val pitch = "You have successfully won a raffle entry! Claim now at the link."
        assertFalse(TransactionalMessage.isTransactional(pitch))
    }

    @Test
    fun `only a spam label is ever corrected`() {
        val receipt = "You paid P145.00 via Gcash. Ref No. 123"
        assertEquals(Classification.SAFE, TransactionalMessage.correct(Classification.SPAM, receipt))
        assertEquals(Classification.SCAM, TransactionalMessage.correct(Classification.SCAM, receipt))
        assertEquals(Classification.UNKNOWN, TransactionalMessage.correct(Classification.UNKNOWN, receipt))
        val promo = "Get 5GB for P59! Register now."
        assertEquals(Classification.SPAM, TransactionalMessage.correct(Classification.SPAM, promo))
    }
}
