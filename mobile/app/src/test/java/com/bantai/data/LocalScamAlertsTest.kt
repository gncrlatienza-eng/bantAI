package com.bantai.data

import com.bantai.data.model.AlertTab
import com.bantai.data.model.Classification
import com.bantai.data.model.SmsMessage
import com.bantai.data.model.tab
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LocalScamAlertsTest {
    private val scam =
        SmsMessage(
            id = 42,
            sender = "09171234567",
            body = "Claim your GCash prize at http://x.top",
            timestamp = 1_700_000_000_000,
            classification = Classification.SCAM,
        )

    @Test
    fun `an on-device scam becomes a To review alert pointing at its SMS row`() {
        val alert = LocalScamAlerts.toAlert(scam)
        assertTrue(LocalScamAlerts.isLocal(alert.messageId))
        assertEquals(42L, LocalScamAlerts.localIdOf(alert.messageId))
        assertEquals(42L, alert.localId)
        assertEquals(scam.sender, alert.sender)
        // Not blocked (auto-block is off by default): it waits for the user.
        assertEquals(AlertTab.TO_REVIEW, alert.tab())
    }

    @Test
    fun `once its sender is blocked it moves to Blocked`() {
        val alert = LocalScamAlerts.toAlert(scam).copy(senderBlocked = true)
        assertEquals(AlertTab.BLOCKED, alert.tab())
    }

    @Test
    fun `server alert ids are not local`() {
        assertFalse(LocalScamAlerts.isLocal("c1f0e2a4-0000-4000-8000-000000000000"))
        assertNull(LocalScamAlerts.localIdOf("c1f0e2a4-0000-4000-8000-000000000000"))
    }
}
