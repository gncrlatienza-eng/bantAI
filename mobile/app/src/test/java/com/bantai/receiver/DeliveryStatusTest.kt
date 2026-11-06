package com.bantai.receiver

import android.provider.Telephony
import org.junit.Assert.assertEquals
import org.junit.Test

class DeliveryStatusTest {
    @Test
    fun `report statuses map onto the provider's delivered, pending and failed`() {
        // TP-Status 0x00: received by the other phone.
        assertEquals(Telephony.Sms.STATUS_COMPLETE, deliveryStatusFor(0x00))
        // 0x20-0x3F: the network is still trying (e.g. their phone is off).
        assertEquals(Telephony.Sms.STATUS_PENDING, deliveryStatusFor(0x20))
        assertEquals(Telephony.Sms.STATUS_PENDING, deliveryStatusFor(0x3F))
        // 0x40 and up: gave up.
        assertEquals(Telephony.Sms.STATUS_FAILED, deliveryStatusFor(0x40))
        assertEquals(Telephony.Sms.STATUS_FAILED, deliveryStatusFor(0x63))
    }
}
