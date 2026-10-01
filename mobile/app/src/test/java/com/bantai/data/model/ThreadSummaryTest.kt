package com.bantai.data.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ThreadSummaryTest {
    private fun thread(
        sender: String,
        vararg bodies: String,
    ) = bodies.mapIndexed { i, body ->
        SmsMessage(id = i.toLong(), sender = sender, body = body, timestamp = i.toLong())
    }

    // Mirrors the real NDRRMC thread: one advisory template repeated with new
    // times, a generic closing line, and an occasional different warning.
    private val ndrrmc =
        thread(
            "NDRRMC",
            "NDRRMC(12:35AM, 16May26) Naganap ang minor phreatic na pagputok sa Bulkang Taal dakong " +
                "12:16AM. Lahat ay pinag-iingat.",
            "NDRRMC(5:43 AM, 8May26) Naganap ang minor phreatic na pagputok sa Bulkang Taal dakong " +
                "4:46 AM. Lahat ay pinag-iingat.",
            "NDRRMC(9:07PM, 29Apr26) Naganap ang minor phreatic na pagputok sa Bulkang Taal dakong " +
                "8:52PM. Lahat ay pinag-iingat.",
            "NDRRMC(8:57PM,9Nov25) Asahan higit 3 metro taas ng alon at storm surge dulot ni Bagyong " +
                "Uwan. Lumikas ang mga nasa mababang lugar.",
            "NDRRMC(7:18PM, 17Jul26) Naganap ang minor phreatomagmatic na pagputok sa Bulkang Taal " +
                "dakong 7:02PM. Lahat ay pinag-iingat.",
        )

    @Test
    fun `a repeated Tagalog advisory is summarised by its main point, not its closing line`() {
        val summary = summarizeThread(ndrrmc)!!
        assertTrue(summary, summary.contains("pagputok sa Bulkang Taal"))
        assertFalse(summary, summary.startsWith("NDRRMC("))
    }

    @Test
    fun `near-duplicate sentences are never picked twice`() {
        val summary = summarizeThread(ndrrmc)!!
        assertEquals(summary, 1, Regex("Bulkang Taal").findAll(summary).count())
        assertTrue(summary, Regex("Lahat ay pinag-iingat").findAll(summary).count() <= 1)
    }

    @Test
    fun `promo footers are left out`() {
        val summary =
            summarizeThread(
                thread(
                    "DITO",
                    "Get DITO Level-Up 199 valid for 30 days and enjoy 20GB all-access data. Stop " +
                        "receiving updates by editing your DITO APP notification settings anytime Per DTI " +
                        "Fair Trade Permit No.",
                    "Log in to your DITO APP to monitor your usage and check your remaining load " +
                        "balance. Stop receiving updates by editing your DITO APP notification settings " +
                        "anytime Per DTI Fair Trade Permit No.",
                ),
            )!!
        assertFalse(summary, summary.contains("Fair Trade Permit"))
    }

    @Test
    fun `a thread with a single usable sentence has no summary`() {
        assertNull(summarizeThread(thread("+639171234567", "ok po", "Hi, running late today.")))
    }

    @Test
    fun `NDRRMC is described as disaster and weather alerts`() {
        assertTrue(threadTopicPhrase(ndrrmc)!!.contains("disaster and weather alerts"))
    }
}
