package com.bantai.data.offline

import com.bantai.data.model.Classification
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ModelCDecisionTest {
    @Test
    fun `routes confident ham and spam`() {
        assertEquals(
            Classification.SAFE,
            routeModelCProbabilities(doubleArrayOf(0.90, 0.07, 0.03)).classification,
        )
        assertEquals(
            Classification.SPAM,
            routeModelCProbabilities(doubleArrayOf(0.05, 0.90, 0.05)).classification,
        )
    }

    @Test
    fun `confident scam is high risk review without claiming blocked`() {
        val decision = routeModelCProbabilities(doubleArrayOf(0.01, 0.02, 0.97))
        assertEquals("Scam", decision.modelLabel)
        assertEquals(Classification.UNKNOWN, decision.classification)
        assertTrue(decision.highRisk)
        assertTrue(decision.requiresReview)
    }

    @Test
    fun `weak winner and near tie remain reviewable`() {
        val weak = routeModelCProbabilities(doubleArrayOf(0.49, 0.30, 0.21))
        val tied = routeModelCProbabilities(doubleArrayOf(0.56, 0.44, 0.0))
        assertEquals(Classification.UNKNOWN, weak.classification)
        assertEquals(Classification.UNKNOWN, tied.classification)
        assertFalse(weak.highRisk)
        assertTrue(tied.requiresReview)
    }
}
