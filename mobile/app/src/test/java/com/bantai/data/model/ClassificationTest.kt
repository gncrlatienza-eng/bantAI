package com.bantai.data.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ClassificationTest {
    @Test
    fun `every label round-trips through its stored value`() {
        for (c in Classification.entries) assertEquals(c, Classification.fromStorage(c.storage))
    }

    @Test
    fun `stored values match the strings phones already have`() {
        // Changing any of these would silently relabel every stored message.
        assertEquals(
            listOf("safe", "unverified", "spam", "unknown", "blocked"),
            Classification.entries.map { it.storage },
        )
    }

    @Test
    fun `unrecognised or missing values read as unlabelled`() {
        assertNull(Classification.fromStorage(null))
        assertNull(Classification.fromStorage("suspicious"))
        assertNull(Classification.fromStorage(""))
    }

    @Test
    fun `only scam and unknown are flagged for review`() {
        assertTrue(Classification.SCAM.isFlagged)
        assertTrue(Classification.UNKNOWN.isFlagged)
        assertFalse(Classification.SPAM.isFlagged)
        assertFalse(Classification.SAFE.isFlagged)
        assertFalse(Classification.UNVERIFIED.isFlagged)
    }
}
