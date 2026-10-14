package com.bantai.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ReportStatusNotificationsTest {
    @Test
    fun `first check only records statuses, so old reviews don't all notify`() {
        val plan = ReportStatusNotifications.plan(null, mapOf("a" to "Validated", "b" to "Pending"))
        assertTrue(plan.notify.isEmpty())
        assertEquals(mapOf("a" to "Validated", "b" to "Pending"), plan.remember)
    }

    @Test
    fun `a pending report that gets reviewed notifies once`() {
        val first = ReportStatusNotifications.plan(mapOf("a" to "Pending"), mapOf("a" to "Validated"))
        assertEquals(listOf("a" to "Validated"), first.notify)
        val second = ReportStatusNotifications.plan(first.remember, mapOf("a" to "Validated"))
        assertTrue(second.notify.isEmpty())
    }

    @Test
    fun `rejections notify too, pending changes don't`() {
        val plan =
            ReportStatusNotifications.plan(
                mapOf("a" to "Pending", "b" to "Pending"),
                mapOf("a" to "Rejected", "b" to "Pending", "c" to "Pending"),
            )
        assertEquals(listOf("a" to "Rejected"), plan.notify)
    }

    @Test
    fun `a report filed and reviewed between checks still notifies`() {
        val plan = ReportStatusNotifications.plan(emptyMap(), mapOf("new" to "Validated"))
        assertEquals(listOf("new" to "Validated"), plan.notify)
    }
}
