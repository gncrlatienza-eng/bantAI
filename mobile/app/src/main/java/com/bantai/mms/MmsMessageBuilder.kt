package com.bantai.mms

import com.bantai.mms.pdu.CharacterSets
import com.bantai.mms.pdu.EncodedStringValue
import com.bantai.mms.pdu.PduBody
import com.bantai.mms.pdu.PduHeaders
import com.bantai.mms.pdu.PduPart
import com.bantai.mms.pdu.SendReq

private const val MILLIS_PER_SECOND = 1000L

// How long the carrier keeps an MMS the recipient hasn't downloaded: a week,
// what AOSP's messaging app asks for.
private const val EXPIRY_SECONDS = 7L * 24 * 60 * 60

/** A photo (or other file) to send in an MMS, already sized for the carrier (see MmsImageCompressor). */
class MmsAttachment(
    val mimeType: String,
    val data: ByteArray,
)

/**
 * SMS or MMS: a message goes as MMS when it has a photo or more than one
 * recipient -- SMS can carry neither. Everything else stays SMS, which every
 * phone and plan handles and which needs no mobile data.
 */
fun needsMms(
    recipientCount: Int,
    attachmentCount: Int,
): Boolean = recipientCount > 1 || attachmentCount > 0

/** Builds the m-send-req PDU for an outgoing MMS. */
object MmsMessageBuilder {
    fun build(
        recipients: List<String>,
        text: String,
        attachments: List<MmsAttachment>,
        nowMillis: Long = System.currentTimeMillis(),
    ): SendReq {
        val body = PduBody()
        val names =
            attachments.mapIndexed { i, a ->
                val kind = if (a.mimeType.startsWith("image/")) "image" else "file"
                "${kind}_$i.${extensionOf(a.mimeType)}"
            }
        val textName = "text_0.txt".takeIf { text.isNotBlank() }
        body.addPart(part("application/smil", "smil.xml", smil(names, textName).toByteArray(Charsets.UTF_8)))
        attachments.forEachIndexed { i, a -> body.addPart(part(a.mimeType, names[i], a.data)) }
        if (textName != null) {
            val textPart = part("text/plain", textName, text.toByteArray(Charsets.UTF_8))
            textPart.charset = CharacterSets.UTF_8
            body.addPart(textPart)
        }
        return SendReq().apply {
            setTo(recipients.map { EncodedStringValue(it) }.toTypedArray())
            date = nowMillis / MILLIS_PER_SECOND
            setBody(body)
            messageSize = (0 until body.partsNum).sumOf { body.getPart(it).data?.size ?: 0 }.toLong()
            messageClass = PduHeaders.MESSAGE_CLASS_PERSONAL_STR.toByteArray()
            expiry = EXPIRY_SECONDS
            priority = PduHeaders.PRIORITY_NORMAL
            deliveryReport = PduHeaders.VALUE_NO
            readReport = PduHeaders.VALUE_NO
        }
    }

    /**
     * The layout part: each picture, then the text, as one slide. Many phones
     * (older Samsungs, feature phones) show nothing without it.
     */
    fun smil(
        attachmentNames: List<String>,
        textName: String?,
    ): String {
        val media =
            attachmentNames.joinToString("") { "<par dur=\"5000ms\"><img src=\"$it\" region=\"Image\"/></par>" } +
                (textName?.let { "<par dur=\"5000ms\"><text src=\"$it\" region=\"Text\"/></par>" } ?: "")
        return "<smil><head><layout><root-layout/>" +
            "<region id=\"Image\" fit=\"meet\" top=\"0\" left=\"0\" height=\"80%\" width=\"100%\"/>" +
            "<region id=\"Text\" top=\"80%\" left=\"0\" height=\"20%\" width=\"100%\"/>" +
            "</layout></head><body>$media</body></smil>"
    }

    private fun part(
        mimeType: String,
        name: String,
        data: ByteArray,
    ) = PduPart().apply {
        contentType = mimeType.toByteArray()
        contentLocation = name.toByteArray()
        contentId = "<$name>".toByteArray()
        this.name = name.toByteArray()
        filename = name.toByteArray()
        this.data = data
    }

    private fun extensionOf(mimeType: String): String =
        when (mimeType) {
            "image/jpeg" -> "jpg"
            "image/png" -> "png"
            "image/gif" -> "gif"
            "image/webp" -> "webp"
            else -> mimeType.substringAfter('/').ifBlank { "bin" }
        }
}
