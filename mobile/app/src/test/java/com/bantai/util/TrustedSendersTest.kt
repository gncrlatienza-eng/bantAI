package com.bantai.util

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TrustedSendersTest {
    @Test
    fun `telco sender IDs are trusted regardless of case or spacing`() {
        listOf("GLOBE", "Globe", "8080", "DITORewards", "DITO Rewards", "smart", "TNT", "GOMO").forEach {
            assertTrue(it, TrustedSenders.isBuiltIn(it))
        }
    }

    @Test
    fun `banks, e-wallets, apps and government sender IDs are trusted`() {
        listOf("GCash", "BDO", "BPI", "Maya", "Google", "Shopee", "Lazada", "Pag-IBIG", "PhilHealth").forEach {
            assertTrue(it, TrustedSenders.isBuiltIn(it))
        }
    }

    @Test
    fun `lookalikes and ordinary numbers are not trusted`() {
        listOf("GLOBE-PROMO", "GL0BE", "GCASH-PH", "G-CASH-REWARDS", "LNKGAME", "TEC CASINO", "+639171234567").forEach {
            assertFalse(it, TrustedSenders.isBuiltIn(it))
        }
    }

    @Test
    fun `the backend registry also makes a sender trusted`() {
        assertTrue(TrustedSenders.isTrusted("ACMEBANK", registryStatus = "verified_organization"))
        assertFalse(TrustedSenders.isTrusted("ACMEBANK", registryStatus = "known_contact"))
        assertFalse(TrustedSenders.isTrusted("ACMEBANK"))
    }

    @Test
    fun `trusted senders and saved contacts are never auto-blocked, strangers can be`() {
        assertTrue(TrustedSenders.neverAutoBlock("GCash"))
        assertTrue(TrustedSenders.neverAutoBlock("ACMEBANK", registryStatus = "verified_organization"))
        assertTrue(TrustedSenders.neverAutoBlock("+639171234567", registryStatus = "known_contact"))
        assertFalse(TrustedSenders.neverAutoBlock("+639171234567", registryStatus = "unknown"))
        assertFalse(TrustedSenders.neverAutoBlock("+639171234567"))
    }
}
