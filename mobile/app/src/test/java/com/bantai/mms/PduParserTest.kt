package com.bantai.mms

import com.bantai.mms.pdu.NotificationInd
import com.bantai.mms.pdu.PduParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The vendored AOSP parser on a hand-built m-notification-ind (OMA MMS
 * encapsulation 1.2), the PDU a carrier's WAP push carries.
 */
class PduParserTest {
    private fun cString(s: String) = s.toByteArray(Charsets.US_ASCII).map { it.toInt() } + 0

    private fun notificationInd(): ByteArray {
        val from = "+639171111111/TYPE=PLMN"
        val bytes =
            listOf(0x8C, 0x82) + // X-Mms-Message-Type: m-notification-ind
                listOf(0x98) + cString("T123") + // X-Mms-Transaction-ID
                listOf(0x8D, 0x92) + // X-Mms-MMS-Version: 1.2
                listOf(0x89, from.length + 2, 0x80) + cString(from) + // From: address-present
                listOf(0x8A, 0x80) + // X-Mms-Message-Class: personal
                listOf(0x8E, 0x02, 0x75, 0x30) + // X-Mms-Message-Size: 30000
                listOf(0x88, 0x05, 0x81, 0x03, 0x03, 0xF4, 0x80) + // X-Mms-Expiry: relative 259200 s
                listOf(0x83) + cString("http://mmsc.example/abc") // X-Mms-Content-Location
        return ByteArray(bytes.size) { bytes[it].toByte() }
    }

    @Test
    fun `parses the fields MmsDownloader needs`() {
        val pdu = PduParser(notificationInd(), true).parse()
        assertTrue(pdu is NotificationInd)
        pdu as NotificationInd
        assertEquals("T123", String(pdu.transactionId, Charsets.ISO_8859_1))
        assertEquals("http://mmsc.example/abc", String(pdu.contentLocation, Charsets.ISO_8859_1))
        assertEquals("+639171111111", MmsParticipants.clean(pdu.from.string))
        assertEquals(30_000L, pdu.messageSize)
        // The parser turns a relative expiry into an absolute time (seconds).
        val expected = System.currentTimeMillis() / 1000 + 259_200
        assertTrue(kotlin.math.abs(pdu.expiry - expected) < 5)
    }
}
