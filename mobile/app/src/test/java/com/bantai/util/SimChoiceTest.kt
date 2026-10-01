package com.bantai.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SimChoiceTest {
    private val globe = Sim(subId = 3, slot = 0, carrier = "Globe")
    private val smart = Sim(subId = 5, slot = 1, carrier = "Smart")
    private val both = listOf(globe, smart)
    private val noDefault = -1

    @Test
    fun `a SIM picked for the conversation wins`() {
        assertEquals(5, SimChoice.pick(both, remembered = 5, conversationSub = 3, defaultSmsSub = 3))
    }

    @Test
    fun `otherwise the SIM the conversation came in on`() {
        assertEquals(5, SimChoice.pick(both, remembered = null, conversationSub = 5, defaultSmsSub = 3))
    }

    @Test
    fun `otherwise the phone's SMS SIM, then SIM 1 when set to ask every time`() {
        assertEquals(5, SimChoice.pick(both, remembered = null, conversationSub = noDefault, defaultSmsSub = 5))
        assertEquals(3, SimChoice.pick(both, remembered = null, conversationSub = noDefault, defaultSmsSub = noDefault))
    }

    @Test
    fun `a removed SIM is never picked`() {
        // The conversation's SIM (7) and the remembered one (9) are no longer in the phone.
        assertEquals(3, SimChoice.pick(both, remembered = 9, conversationSub = 7, defaultSmsSub = noDefault))
    }

    @Test
    fun `no SIMs listed leaves the choice to Android`() {
        assertNull(SimChoice.pick(emptyList(), remembered = null, conversationSub = 3, defaultSmsSub = 3))
    }

    @Test
    fun `labels match the phone's own`() {
        assertEquals("SIM 2 · Smart", smart.label)
        assertEquals("SIM 1", Sim(1, 0, null).label)
    }
}
