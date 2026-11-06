package com.bantai.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SmsRecipientValidationTest {
    @Test
    fun `telco short codes take replies`() {
        listOf("8080", "3733", "4438", "1111", "3349", "9999", "4545", "185").forEach {
            assertEquals(it, SenderReplyKind.SERVICE_CODE, replyKindFor(it))
            assertTrue(it, isValidSmsRecipient(it))
        }
    }

    @Test
    fun `alphanumeric sender ids are one-way`() {
        listOf("GCash", "GLOBE", "DITO", "GLOBEREWARD", "NDRRMC", "LOOK LIST", "TrueMove-H").forEach {
            assertEquals(it, SenderReplyKind.ONE_WAY, replyKindFor(it))
            assertFalse(it, isValidSmsRecipient(it))
        }
    }

    @Test
    fun `mobile numbers in local and international form are ordinary replies`() {
        listOf("+639171234567", "09171234567", "0994 069 6345", "+63 917-123-4567").forEach {
            assertEquals(it, SenderReplyKind.PHONE_NUMBER, replyKindFor(it))
        }
    }

    @Test
    fun `known codes are labelled and unknown ones are not guessed`() {
        assertEquals("Globe/TM promo registration", serviceCodeLabel("8080"))
        assertEquals("Globe load loan", serviceCodeLabel("3733"))
        assertNull(serviceCodeLabel("3349"))
    }
}
