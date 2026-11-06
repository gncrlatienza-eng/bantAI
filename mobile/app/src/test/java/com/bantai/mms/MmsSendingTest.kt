package com.bantai.mms

import com.bantai.mms.pdu.PduHeaders
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MmsSendingTest {
    @Test
    fun `only photos or several recipients need MMS`() {
        assertFalse(needsMms(recipientCount = 1, attachmentCount = 0))
        assertTrue(needsMms(recipientCount = 2, attachmentCount = 0))
        assertTrue(needsMms(recipientCount = 1, attachmentCount = 1))
    }

    @Test
    fun `photos share the carrier limit, minus room for text and headers`() {
        assertEquals(300 * 1024 - 8 * 1024, MmsImageCompressor.budgetPerImage(300 * 1024, 1))
        assertEquals((300 * 1024 - 8 * 1024) / 3, MmsImageCompressor.budgetPerImage(300 * 1024, 3))
    }

    @Test
    fun `builds a send request with layout, photo and text parts`() {
        val photo = MmsAttachment("image/jpeg", ByteArray(1000))
        val recipients = listOf("+639171111111", "+639172222222")
        val req = MmsMessageBuilder.build(recipients, "hi all", listOf(photo), 1_800_000_000_000)

        assertEquals(PduHeaders.MESSAGE_TYPE_SEND_REQ, req.messageType)
        assertEquals(listOf("+639171111111", "+639172222222"), req.to.map { it.string })
        assertEquals(1_800_000_000L, req.date)
        val types = (0 until req.body.partsNum).map { String(req.body.getPart(it).contentType) }
        assertEquals(listOf("application/smil", "image/jpeg", "text/plain"), types)
        val smil = String(req.body.getPart(0).data)
        assertTrue(smil.contains("src=\"image_0.jpg\"") && smil.contains("src=\"text_0.txt\""))
    }

    @Test
    fun `a photo with no text has no text part`() {
        val png = MmsAttachment("image/png", ByteArray(10))
        val req = MmsMessageBuilder.build(listOf("+639171111111"), " ", listOf(png))
        val types = (0 until req.body.partsNum).map { String(req.body.getPart(it).contentType) }
        assertEquals(listOf("application/smil", "image/png"), types)
    }
}
