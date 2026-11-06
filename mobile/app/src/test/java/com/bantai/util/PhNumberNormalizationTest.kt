package com.bantai.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PhNumberNormalizationTest {
    @Test
    fun `normalizes a local 09-prefixed number`() {
        assertEquals("+639171234567", normalizePhNumber("09171234567"))
    }

    @Test
    fun `normalizes a bare 10-digit number`() {
        assertEquals("+639171234567", normalizePhNumber("9171234567"))
    }

    @Test
    fun `accepts an already-plus63 SIM-detected number with spaces`() {
        assertEquals("+639171234567", normalizePhNumber("+63 917 123 4567"))
    }

    @Test
    fun `normalizes a 0063-prefixed number`() {
        assertEquals("+639171234567", normalizePhNumber("0063 917 123 4567"))
    }

    @Test
    fun `normalizes a bare 63-prefixed number`() {
        assertEquals("+639171234567", normalizePhNumber("639171234567"))
    }

    @Test
    fun `strips separators before validating`() {
        assertEquals("+639171234567", normalizePhNumber("0917-123-4567"))
    }

    @Test
    fun `rejects a non-PH E164 number instead of mangling it`() {
        assertNull(normalizePhNumber("+14155552671"))
    }

    @Test
    fun `rejects a landline number`() {
        assertNull(normalizePhNumber("028631800"))
    }

    @Test
    fun `rejects a too-short number`() {
        assertNull(normalizePhNumber("091712345"))
    }

    @Test
    fun `rejects blank input`() {
        assertNull(normalizePhNumber(""))
    }
}
