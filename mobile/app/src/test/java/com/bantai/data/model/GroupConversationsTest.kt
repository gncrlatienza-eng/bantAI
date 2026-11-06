package com.bantai.data.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GroupConversationsTest {
    @Test
    fun `group keys round-trip and aren't mistaken for numbers`() {
        assertEquals("group:42", groupKey(42))
        assertEquals(42L, groupThreadIdOf("group:42"))
        assertNull(groupThreadIdOf("+639171111111"))
        assertNull(groupThreadIdOf("group:abc"))
        assertTrue(isGroupKey("group:7"))
        assertFalse(isGroupKey("GCash"))
    }

    @Test
    fun `normalizing a group key leaves it alone`() {
        assertEquals("group:42", normalizeSenderKey("group:42"))
    }

    @Test
    fun `group titles name up to three people`() {
        assertEquals("Group", groupTitle(emptyList()))
        assertEquals("Ana and Ben", groupTitle(listOf("Ana", "Ben")))
        assertEquals("Ana, Ben and Carl", groupTitle(listOf("Ana", "Ben", "Carl")))
        assertEquals("Ana, Ben, Carl +2", groupTitle(listOf("Ana", "Ben", "Carl", "Dan", "Eve")))
    }

    @Test
    fun `a group MMS is filed under its group, not under whoever sent it`() {
        val ana = "+639171111111"
        val ben = "+639172222222"
        val fromAnaInGroup = SmsMessage(id = 3, sender = ana, body = "group hi", timestamp = 30, groupThreadId = 9)
        val fromAnaDirect = SmsMessage(id = 2, sender = "09171111111", body = "just us", timestamp = 20)
        val fromBenInGroup = SmsMessage(id = 1, sender = ben, body = "hello all", timestamp = 10, groupThreadId = 9)

        val rows = listOf(fromAnaInGroup, fromAnaDirect, fromBenInGroup).groupedBySenderLatest(summarizeUnread = false)

        assertEquals(listOf("group:9", "09171111111"), rows.map { it.sender })
        assertEquals("group hi", rows.first().body)
        assertEquals("group:9", fromBenInGroup.conversationKey)
        assertEquals("+639171111111", fromAnaDirect.conversationKey)
    }
}
