package com.bantai.util

import com.bantai.util.SmsLinkSafety.LINK_HIDDEN
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SmsLinkSafetyTest {
    @Test
    fun `hides the whole host, subdomains included`() {
        assertEquals("Log in at $LINK_HIDDEN now", SmsLinkSafety.hideLinks("Log in at secure.bdo-login.com now"))
    }

    @Test
    fun `hides shorteners and unlisted endings once they have a path`() {
        assertEquals("Claim: $LINK_HIDDEN", SmsLinkSafety.hideLinks("Claim: bit.ly/3xYz9"))
        assertEquals("Go $LINK_HIDDEN", SmsLinkSafety.hideLinks("Go promo.weirdtld/abc"))
    }

    @Test
    fun `hides scam endings with no path`() {
        assertEquals("Visit $LINK_HIDDEN", SmsLinkSafety.hideLinks("Visit gcash-rewards.shop"))
        assertEquals("Visit $LINK_HIDDEN", SmsLinkSafety.hideLinks("Visit https://x.y/z?a=1"))
    }

    @Test
    fun `hides a host that ends a sentence`() {
        assertEquals("Login at $LINK_HIDDEN.", SmsLinkSafety.hideLinks("Login at bdo-login.com."))
        assertEquals("Go to $LINK_HIDDEN. Now", SmsLinkSafety.hideLinks("Go to scam.com. Now"))
        assertEquals("Visit $LINK_HIDDEN, then pay", SmsLinkSafety.hideLinks("Visit gcash.ph, then pay"))
    }

    @Test
    fun `leaves amounts, times and ordinary words alone`() {
        val text = "You won P1,500.00 at 3.30pm, e.g. today and/or tomorrow."
        assertEquals(text, SmsLinkSafety.hideLinks(text))
    }

    @Test
    fun `maskSensitive also hides numbers and codes`() {
        val masked = SmsLinkSafety.maskSensitive("Text 09171234567, OTP 482913, acct 1234 5678 9012 at bit.ly/a")
        assertFalse(masked.contains("0917"))
        assertFalse(masked.contains("482913"))
        assertFalse(masked.contains("9012"))
        assertFalse(masked.contains("bit.ly"))
    }

    // A pathological text must not stall the UI thread (catastrophic backtracking).
    @Test
    fun `long dotted junk is masked quickly`() {
        val junk = ("a".repeat(60) + ".").repeat(400) + " " + "x-".repeat(5000)
        val start = System.nanoTime()
        SmsLinkSafety.maskSensitive(junk)
        val ms = (System.nanoTime() - start) / 1_000_000
        assertTrue("took ${ms}ms", ms < 500)
    }

    @Test
    fun `defang breaks the dots`() {
        assertEquals("bdo-login[.]com", SmsLinkSafety.defang("bdo-login.com"))
    }
}
