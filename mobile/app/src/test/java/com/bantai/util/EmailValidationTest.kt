package com.bantai.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class EmailValidationTest {
    @Test
    fun normalizesAndAcceptsAValidAddress() {
        assertEquals("user.name+mobile@gmail.com", normalizeEmailAddress(" User.Name+Mobile@Gmail.com "))
        assertTrue(isValidEmailAddress(" User.Name+Mobile@Gmail.com "))
    }

    @Test
    fun rejectsMissingOrInvalidDomains() {
        assertFalse(isValidEmailAddress("user@gmail"))
        assertFalse(isValidEmailAddress("not-an-email"))
        assertFalse(isValidEmailAddress("user @gmail.com"))
    }
}
