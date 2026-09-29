package com.bantai.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class SpoofWarningTest {
    @Test
    fun `a bank name sending an outside link is flagged`() {
        val warning =
            SmsRiskSignals.spoofWarning(
                "BDO",
                "BDO Transaction Alert: PHP 18,900 transfer processed. " +
                    "If unauthorized, cancel here: bdo-secure.xyz/cancel",
            )
        assertEquals("Banks and e-wallets don't send links by text. This may not be from BDO.", warning)
    }

    @Test
    fun `a bank linking its own official domain is not flagged`() {
        assertNull(SmsRiskSignals.spoofWarning("BPI", "Learn more about your new card at bpi.com.ph"))
    }

    @Test
    fun `a telco's own short link is not flagged`() {
        assertNull(SmsRiskSignals.spoofWarning("GLOBE", "Get 50GB for P299! Register at glbe.co/go50 or dial *143#"))
    }

    @Test
    fun `asking for an OTP is flagged, warning never to share it is not`() {
        assertNotNull(SmsRiskSignals.spoofWarning("GCash", "To verify your account, reply with your OTP now."))
        assertNull(
            SmsRiskSignals.spoofWarning(
                "GCash",
                "Your GCash OTP is 123456. NEVER share your OTP with anyone, even GCash employees.",
            ),
        )
    }

    @Test
    fun `untrusted senders are left to the normal scam checks`() {
        assertNull(SmsRiskSignals.spoofWarning("+639171234567", "cancel here: bdo-secure.xyz/cancel"))
    }

    @Test
    fun `financial names are a subset of trusted names`() {
        listOf("BDO", "GCash", "Pag-IBIG").forEach { assertEquals(it, true, TrustedSenders.isFinancial(it)) }
        listOf("GLOBE", "Google", "Shopee").forEach { assertEquals(it, false, TrustedSenders.isFinancial(it)) }
    }
}
