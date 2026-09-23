package com.bantai.data.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SmsConversationsTest {
    private fun message(
        id: Long,
        sender: String,
        body: String,
        timestamp: Long,
        isRead: Boolean = true,
    ) = SmsMessage(id = id, sender = sender, body = body, timestamp = timestamp, isRead = isRead)

    @Test
    fun `normalizeSenderKey collapses formatting differences`() {
        assertEquals(normalizeSenderKey("+639171234567"), normalizeSenderKey("+63 917-123-4567"))
        assertEquals(normalizeSenderKey("(0917) 123-4567"), normalizeSenderKey("09171234567"))
    }

    @Test
    fun `groupedBySenderLatest keeps one row per normalized sender`() {
        // "0917-123-4567" and "0917 123 4567" differ only by the punctuation
        // normalizeSenderKey strips (spaces/hyphens/parens) -- they group as
        // the same conversation. A *format* difference such as "0917..." vs
        // "+63917..." is a separate, still-open gap (see MessageDetailScreen's
        // H3 comment) and isn't what this test is checking.
        // Newest-first input, as SmsRepository queries return.
        val messages =
            listOf(
                message(3, "0917-123-4567", "third", timestamp = 300, isRead = false),
                message(2, "0917 123 4567", "second", timestamp = 200, isRead = true),
                message(1, "Globe", "unrelated sender", timestamp = 100, isRead = true),
            )
        val grouped = messages.groupedBySenderLatest()
        assertEquals(2, grouped.size)
        val phoneRow = grouped.first { normalizeSenderKey(it.sender) == normalizeSenderKey("0917-123-4567") }
        assertEquals(3L, phoneRow.id)
        assertFalseIsRead(phoneRow)
    }

    private fun assertFalseIsRead(row: SmsMessage) = assertEquals(false, row.isRead)

    @Test
    fun `a single unread message keeps its own body, not a summary`() {
        val messages = listOf(message(1, "Globe", "one unread text", timestamp = 100, isRead = false))
        val grouped = messages.groupedBySenderLatest()
        assertEquals("one unread text", grouped.single().body)
        assertEquals(false, grouped.single().isUnreadThreadSummary)
    }

    @Test
    fun `two or more unread messages produce an extractive summary`() {
        val messages =
            listOf(
                message(
                    id = 2,
                    sender = "Globe",
                    body = "Your bill is now available online for viewing and payment.",
                    timestamp = 200,
                    isRead = false,
                ),
                message(
                    id = 1,
                    sender = "Globe",
                    body = "Your data promo has expired, reload now to continue browsing.",
                    timestamp = 100,
                    isRead = false,
                ),
            )
        val summary = summarizeUnreadThread(messages)
        assertTrue(summary != null && summary.isNotBlank())
    }

    @Test
    fun `summarizeUnreadThread returns null below the minimum unread count`() {
        val messages = listOf(message(1, "Globe", "Just one message here.", 100, isRead = false))
        assertNull(summarizeUnreadThread(messages))
    }

    @Test
    fun `summarizeThread returns a non-blank result for a multi-sentence thread`() {
        val messages =
            listOf(
                message(1, "Globe", "Your bill is now available online for viewing and payment.", timestamp = 100),
                message(2, "Globe", "Your data promo has expired, reload now to continue browsing.", timestamp = 200),
                message(3, "Globe", "Thank you for choosing Globe as your service provider.", timestamp = 300),
            )
        val summary = summarizeThread(messages)
        assertTrue(summary != null && summary.isNotBlank())
    }

    @Test
    fun `summarizeThread returns null for fewer than two sentences`() {
        val messages = listOf(message(1, "Globe", "Just one message here.", timestamp = 100))
        assertNull(summarizeThread(messages))
    }

    @Test
    fun `summarizeThread restores chronological order regardless of score`() {
        // Selecting all sentences (maxSentences >= total) forces the result
        // back into chronological order even though "unique distinctive rare
        // terms" (the second sentence) would score higher than "the the the"
        // (deliberately full of a stop word) if order weren't restored.
        val messages =
            listOf(
                message(1, "Globe", "the the the.", timestamp = 100),
                message(2, "Globe", "unique distinctive rare terms.", timestamp = 200),
            )
        val summary = summarizeThread(messages, maxSentences = 2, maxChars = 200)
        assertTrue(summary != null && summary.startsWith("the the the"))
    }

    @Test
    fun `summarizeThread respects maxChars`() {
        val messages =
            listOf(
                message(1, "Globe", "This is the first fairly long sentence in the thread.", timestamp = 100),
                message(2, "Globe", "This is the second fairly long sentence in the thread.", timestamp = 200),
                message(3, "Globe", "This is the third fairly long sentence in the thread.", timestamp = 300),
            )
        val summary = summarizeThread(messages, maxSentences = 3, maxChars = 20)
        assertTrue(summary != null && summary.length <= 20)
    }
}
