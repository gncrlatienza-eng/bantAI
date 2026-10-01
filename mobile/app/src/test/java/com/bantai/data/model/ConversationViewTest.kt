package com.bantai.data.model

import org.junit.Assert.assertEquals
import org.junit.Test

class ConversationViewTest {
    private val globeThread =
        listOf(
            SmsMessage(id = 1, sender = "GLOBE", body = "Your balance is P12", classification = Classification.SAFE),
            SmsMessage(id = 2, sender = "GLOBE", body = "Go+99 JUST FOR YOU", classification = Classification.SPAM),
            SmsMessage(id = 3, sender = "GLOBE", body = "Your OTP is 1234", classification = Classification.UNVERIFIED),
            SmsMessage(id = 4, sender = "GLOBE", body = "Check this link", classification = Classification.UNKNOWN),
            SmsMessage(id = 5, sender = "GLOBE", body = "Scam", classification = Classification.SCAM),
            SmsMessage(id = 6, sender = "GLOBE", body = "GO99", isOutgoing = true),
        )

    private fun ids(view: ConversationView) = globeThread.filter { view.includes(it) }.map { it.id }

    @Test
    fun `messages view keeps ham and the user's own replies`() {
        assertEquals(listOf(1L, 3L, 6L), ids(ConversationView.MESSAGES))
    }

    @Test
    fun `spam view keeps promos and the reply that registered one`() {
        assertEquals(listOf(2L, 6L), ids(ConversationView.SPAM))
    }

    @Test
    fun `unknown view keeps messages needing review`() {
        assertEquals(listOf(4L, 6L), ids(ConversationView.UNKNOWN))
    }

    @Test
    fun `unrecognised route value falls back to the full thread`() {
        assertEquals(ConversationView.ALL, ConversationView.fromRoute("bogus"))
        assertEquals(ConversationView.SPAM, ConversationView.fromRoute("spam"))
    }
}
