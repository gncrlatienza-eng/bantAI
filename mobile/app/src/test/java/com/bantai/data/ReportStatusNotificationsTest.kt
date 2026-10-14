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

    @Test
    fun `a newly rejected report with a reviewer label is refiled there`() {
        val plan =
            ReportStatusNotifications.plan(
                mapOf("a" to "Pending", "b" to "Pending"),
                mapOf("a" to "Rejected", "b" to "Rejected"),
            )
        val refiles = ReportStatusNotifications.refiles(plan, mapOf("a" to "Ham", "b" to "Spam"))
        assertEquals(mapOf("a" to "Ham", "b" to "Spam"), refiles)
    }

    @Test
    fun `accepted, unlabelled and invalid reviews leave the text where it is`() {
        val plan =
            ReportStatusNotifications.plan(
                mapOf("a" to "Pending", "b" to "Pending", "c" to "Pending"),
                mapOf("a" to "Validated", "b" to "Rejected", "c" to "Rejected"),
            )
        val refiles = ReportStatusNotifications.refiles(plan, mapOf("a" to "Ham", "b" to null, "c" to "Scam"))
        assertTrue(refiles.isEmpty())
    }

    @Test
    fun `a rejection seen before, or on the first check, is not refiled again`() {
        val firstCheck = ReportStatusNotifications.plan(null, mapOf("a" to "Rejected"))
        assertTrue(ReportStatusNotifications.refiles(firstCheck, mapOf("a" to "Ham")).isEmpty())
        val again = ReportStatusNotifications.plan(firstCheck.remember, mapOf("a" to "Rejected"))
        assertTrue(ReportStatusNotifications.refiles(again, mapOf("a" to "Ham")).isEmpty())
    }
}
