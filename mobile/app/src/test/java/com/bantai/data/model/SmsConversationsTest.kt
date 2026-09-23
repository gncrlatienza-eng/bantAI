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
}
