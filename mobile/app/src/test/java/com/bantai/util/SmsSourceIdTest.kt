package com.bantai.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Base64

/**
 * Audit ANDROID-02 (2026-10-13): the sourceId key used to be a hash of
 * ANDROID_ID, identical for every account on the phone, so the server could
 * link separate accounts to one device.
 */
class SmsSourceIdTest {
    private val installA = ByteArray(32) { it.toByte() }
    private val installB = ByteArray(32) { (it * 7 + 3).toByte() }

    @Test
    fun `same account on the same install always gets the same key`() {
        assertEquals(SmsSourceId.accountKey(installA, "user-1"), SmsSourceId.accountKey(installA, "user-1"))
    }

    @Test
    fun `two accounts on one phone get unrelated keys`() {
        assertNotEquals(SmsSourceId.accountKey(installA, "user-1"), SmsSourceId.accountKey(installA, "user-2"))
    }

    @Test
    fun `the same account on another install gets a different key`() {
        assertNotEquals(SmsSourceId.accountKey(installA, "user-1"), SmsSourceId.accountKey(installB, "user-1"))
    }

    @Test
    fun `key keeps the 16-hex-char shape the backend already accepts`() {
        assertTrue(Regex("^[0-9a-f]{16}$").matches(SmsSourceId.accountKey(installA, "user-1")))
    }

    @Test
    fun `account id is read from the JWT subject`() {
        val payload =
            Base64
                .getUrlEncoder()
                .withoutPadding()
                .encodeToString("""{"sub":"5892f7b5-91f3","role":"USER","iat":1}""".toByteArray())
        assertEquals("5892f7b5-91f3", SmsSourceId.jwtSubject("eyJhbGciOiJIUzI1NiJ9.$payload.sig"))
    }

    @Test
    fun `a token that is not a JWT has no subject`() {
        assertNull(SmsSourceId.jwtSubject("not-a-jwt"))
        assertNull(SmsSourceId.jwtSubject("a.%%%.c"))
    }
}
