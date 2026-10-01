package com.bantai.mms

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MmsParticipantsTest {
    private val ana = "+639171111111"
    private val ben = "+639172222222"
    private val me = "+639173333333"

    @Test
    fun `strips the PLMN suffix and drops placeholders`() {
        assertEquals(ana, MmsParticipants.clean("$ana/TYPE=PLMN"))
        assertNull(MmsParticipants.clean("insert-address-token"))
        assertNull(MmsParticipants.clean("  "))
        assertNull(MmsParticipants.clean(null))
    }

    @Test
    fun `one recipient is a 1-to-1 message even when this phone's number is unknown`() {
        val others = MmsParticipants.others(ana, listOf(me), emptyList(), selfNumbers = emptyList())
        assertEquals(listOf(ana), others)
        assertFalse(MmsParticipants.isGroup(others))
    }

    @Test
    fun `a placeholder recipient is still 1-to-1`() {
        val others = MmsParticipants.others(ana, listOf("insert-address-token"), emptyList(), emptyList())
        assertEquals(listOf(ana), others)
    }

    @Test
    fun `several recipients make a group, minus this phone when its number is known`() {
        // "0917..." is this phone's number in local form: still recognised.
        val others = MmsParticipants.others(ana, listOf(me, ben), emptyList(), selfNumbers = listOf("09173333333"))
        assertEquals(listOf(ana, ben), others)
        assertTrue(MmsParticipants.isGroup(others))
    }

    @Test
    fun `cc recipients count toward a group`() {
        val others = MmsParticipants.others(ana, listOf(me), listOf(ben), selfNumbers = listOf(me))
        assertEquals(listOf(ana, ben), others)
    }

    @Test
    fun `the same person in several spellings is listed once`() {
        val others = MmsParticipants.others(ana, listOf("09171111111", ben, me), emptyList(), listOf(me))
        assertEquals(listOf(ana, ben), others)
    }
}
