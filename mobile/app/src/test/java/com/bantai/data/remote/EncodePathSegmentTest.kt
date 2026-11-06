package com.bantai.data.remote

import org.junit.Assert.assertEquals
import org.junit.Test

class EncodePathSegmentTest {
    @Test
    fun `a space is percent-encoded, never a plus`() {
        // Express keeps "+" literally in a path, so "BDO+Bank" hashed to a
        // different sender than "BDO Bank" and unblock silently 404'd.
        assertEquals("BDO%20Bank", encodePathSegment("BDO Bank"))
    }

    @Test
    fun `a leading plus in a phone number is escaped`() {
        assertEquals("%2B639171234567", encodePathSegment("+639171234567"))
    }

    @Test
    fun `slashes cannot split the path`() {
        assertEquals("a%2Fb", encodePathSegment("a/b"))
    }
}
