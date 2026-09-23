package com.bantai.util

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NameValidationTest {
    @Test
    fun `accepts a plain name`() {
        assertTrue(isValidName("Maria"))
    }

    @Test
    fun `accepts real PH names with punctuation between letters`() {
        assertTrue(isValidName("Ma. Teresa"))
        assertTrue(isValidName("Dela Cruz-Santos"))
        assertTrue(isValidName("D'Angelo"))
    }

    @Test
    fun `rejects blank input`() {
        assertFalse(isValidName(""))
        assertFalse(isValidName("   "))
    }

    @Test
    fun `rejects leading or trailing punctuation`() {
        assertFalse(isValidName("-Maria"))
        assertFalse(isValidName(".Teresa"))
        assertFalse(isValidName("Maria-"))
    }

    @Test
    fun `rejects doubled punctuation`() {
        assertFalse(isValidName("Ma--ria"))
        assertFalse(isValidName("D''Angelo"))
    }

    @Test
    fun `rejects digits and symbols`() {
        assertFalse(isValidName("Maria123"))
        assertFalse(isValidName("Maria!"))
        assertFalse(isValidName("😀"))
    }
}
