package com.bantai.data

import com.bantai.data.model.Classification
import org.junit.Assert.assertEquals
import org.junit.Test

class MessageClassifierTest {
    private val scam = "Your GCash account will be suspended. Verify your account now at gcash-verify.com/login"
    private val ordinary = "Hi, see you at 7 later"

    @Test
    fun `offline heuristic never claims SCAM or SAFE`() {
        assertEquals(Classification.UNKNOWN, MessageClassifier.classify(scam))
        assertEquals(Classification.UNVERIFIED, MessageClassifier.classify(ordinary))
    }

    @Test
    fun `a stored verdict wins over the heuristic`() {
        assertEquals(Classification.SPAM, MessageClassifier.resolve(Classification.SPAM, ordinary, "09171234567"))
        assertEquals(Classification.SAFE, MessageClassifier.resolve(Classification.SAFE, scam, "09171234567"))
    }

    @Test
    fun `no stored verdict falls back to the heuristic`() {
        assertEquals(Classification.UNKNOWN, MessageClassifier.resolve(null, scam, "09171234567"))
    }

    @Test
    fun `a receipt the model called spam reads as safe`() {
        val receipt = "You paid P145.00 via Gcash. Ref No. 123"
        assertEquals(Classification.SAFE, MessageClassifier.resolve(Classification.SPAM, receipt, "GCash"))
    }

    @Test
    fun `a trusted built-in sender is never shown as a scam, only for review`() {
        assertEquals(Classification.UNKNOWN, MessageClassifier.resolve(Classification.SCAM, scam, "GLOBE"))
        assertEquals(Classification.SCAM, MessageClassifier.resolve(Classification.SCAM, scam, "09171234567"))
    }
}
