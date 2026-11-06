package com.bantai.data.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ThreadTopicTest {
    private fun sms(
        body: String,
        classification: Classification = Classification.SAFE,
    ) = SmsMessage(id = body.hashCode().toLong(), sender = "GLOBE", body = body, classification = classification)

    @Test
    fun `names the dominant topic and sender`() {
        val messages =
            listOf(
                sms("Enjoy 50% off with your Globe Rewards points this week."),
                sms("Register to GoSURF50 promo now and get bonus data."),
                sms("Your bill of P1,299 is due on Oct 5."),
            )
        val description = describeThread(messages, "GLOBE")!!
        assertTrue(description, description.startsWith("Messages from GLOBE are mostly about rewards and promos"))
        assertTrue(description, description.contains("with some about bills and payments"))
        assertTrue(description, description.contains("mention money amounts"))
    }

    @Test
    fun `warns when a verification code is present`() {
        val description = describeThread(listOf(sms("Your OTP is 482913. Do not share this code.")), "GCash")!!
        assertTrue(description, description.contains("Never share it with anyone"))
    }

    @Test
    fun `phone number with no topic reads as personal`() {
        val description = describeThread(listOf(sms("Hi, running late, see ya")), "+639171234567")
        assertEquals("This looks like a personal message.", description)
    }

    @Test
    fun `reports how many were marked spam`() {
        val messages =
            listOf(
                sms("Get a FREE voucher today only!", classification = Classification.SPAM),
                sms("Promo: double points on load", classification = Classification.SPAM),
                sms("Thanks for loading with us"),
            )
        val description = describeThread(messages, "SMART")!!
        assertTrue(description, description.contains("BantAI marked 2 of them as spam."))
    }

    @Test
    fun `whole-word matching avoids false topics`() {
        assertNull(threadTopicPhrase(listOf(sms("Download the file, residue is fine"))))
    }

    @Test
    fun `empty thread has no description`() {
        assertNull(describeThread(emptyList(), "GLOBE"))
    }
}
