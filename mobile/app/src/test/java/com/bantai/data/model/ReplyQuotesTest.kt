package com.bantai.data.model

import com.bantai.data.db.ReplyQuoteEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ReplyQuotesTest {
    private fun sent(
        id: Long,
        body: String,
        at: Long,
    ) = SmsMessage(id = id, sender = "09171234567", body = body, timestamp = at, isOutgoing = true)

    private fun quote(
        body: String,
        at: Long,
        quoted: String = "Are you coming?",
    ) = ReplyQuoteEntity(
        addressKey = "09171234567",
        body = body,
        sentAt = at,
        quotedOutgoing = false,
        quotedBody = quoted,
    )

    @Test
    fun `a reply is matched to its sent bubble`() {
        val q = quote("Yes, on my way", at = 1_000_000)
        val result = matchReplyQuotes(listOf(sent(1, "Yes, on my way", 1_000_400)), listOf(q))
        assertEquals(q, result[1])
    }

    @Test
    fun `incoming messages and different text are never quoted`() {
        val incoming = SmsMessage(id = 2, body = "Yes, on my way", timestamp = 1_000_000, isOutgoing = false)
        val other = sent(3, "Something else", 1_000_000)
        assertTrue(matchReplyQuotes(listOf(incoming, other), listOf(quote("Yes, on my way", 1_000_000))).isEmpty())
    }

    @Test
    fun `the same words sent again later are not quoted twice`() {
        val q = quote("ok", at = 1_000_000)
        val result = matchReplyQuotes(listOf(sent(1, "ok", 1_000_100), sent(2, "ok", 1_000_900)), listOf(q))
        assertEquals(setOf(1L), result.keys)
    }

    @Test
    fun `a match needs the send time to be close`() {
        val result = matchReplyQuotes(listOf(sent(1, "ok", 1_000_000 + 10 * 60_000)), listOf(quote("ok", 1_000_000)))
        assertTrue(result.isEmpty())
    }
}
