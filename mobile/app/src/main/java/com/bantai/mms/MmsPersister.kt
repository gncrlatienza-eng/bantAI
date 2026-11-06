package com.bantai.mms

import android.annotation.SuppressLint
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.provider.Telephony
import android.telephony.SubscriptionManager
import android.util.Log
import com.bantai.mms.pdu.CharacterSets
import com.bantai.mms.pdu.EncodedStringValue
import com.bantai.mms.pdu.PduHeaders
import com.bantai.mms.pdu.PduPart
import com.bantai.mms.pdu.RetrieveConf
import com.bantai.mms.pdu.SendReq
import com.bantai.util.OwnNumber

private const val TAG = "MmsPersister"
private const val MILLIS_PER_SECOND = 1000L
private const val CONTENT_TYPE_TEXT = "text/plain"
private const val CONTENT_TYPE_SMIL = "application/smil"

/** What was saved, for the notification and scam check that follow. */
data class PersistedMms(
    val rowId: Long,
    val threadId: Long,
    val sender: String,
    /** Everyone besides this phone; more than one means a group conversation. */
    val others: List<String>,
    val text: String,
    val imageCount: Int,
    val otherAttachments: Int,
)

/**
 * Saves a downloaded MMS into the phone's own MMS store (content://mms), the
 * same place the built-in messaging app writes to, so it shows up in any SMS app
 * the user switches to later. Replaces AOSP's PduPersister, which relies on
 * hidden platform APIs; only the public Telephony.Mms columns are used here.
 */
object MmsPersister {
    /** Returns null when the provider refused the write; a partial row is removed. */
    fun persist(
        context: Context,
        conf: RetrieveConf,
        subId: Int,
        receivedAt: Long,
        contentLocation: String,
    ): PersistedMms? {
        val sender = MmsParticipants.clean(conf.from?.string) ?: return null
        val others =
            MmsParticipants.others(
                from = sender,
                to = conf.to.strings(),
                cc = conf.cc.strings(),
                selfNumbers = selfNumbers(context),
            )
        val resolver = context.contentResolver
        val threadId = Telephony.Threads.getOrCreateThreadId(context, others.toSet())
        val parts = conf.body?.let { body -> (0 until body.partsNum).map(body::getPart) }.orEmpty()
        val uri =
            resolver.insert(Telephony.Mms.Inbox.CONTENT_URI, messageValues(conf, threadId, subId, receivedAt, parts))
                ?: return null
        val rowId = ContentUris.parseId(uri)
        return runCatching {
            val texts = mutableListOf<String>()
            var images = 0
            var otherAttachments = 0
            for (part in parts) {
                val type = part.contentType.ascii().lowercase()
                when {
                    type == CONTENT_TYPE_TEXT -> decodeText(part)?.takeIf { it.isNotBlank() }?.let { texts += it }
                    type.startsWith("image/") -> images++
                    type != CONTENT_TYPE_SMIL -> otherAttachments++
                }
                insertPart(context, rowId, part, type)
            }
            insertAddresses(context, rowId, conf, sender)
            // Written last, once parts exist: the location lets the platform
            // match a carrier's repeat notification to this row.
            val location = ContentValues().apply { put(Telephony.Mms.CONTENT_LOCATION, contentLocation) }
            resolver.update(uri, location, null, null)
            PersistedMms(rowId, threadId, sender, others, texts.joinToString("\n"), images, otherAttachments)
        }.onFailure {
            Log.e(TAG, "Saving MMS $rowId failed; removing the partial row", it)
            runCatching { resolver.delete(uri, null, null) }
        }.getOrNull()
    }

    /**
     * Saves an MMS BantAI is about to send, as an outbox row ("Sending…") in
     * [threadId]. Android's MMS service doesn't store what the default SMS app
     * sends, so without this a sent picture message would vanish. Returns the
     * row id, or null when the provider refused.
     */
    fun persistOutgoing(
        context: Context,
        req: SendReq,
        recipients: List<String>,
        threadId: Long,
        subId: Int,
    ): Long? {
        val resolver = context.contentResolver
        val parts = req.body?.let { body -> (0 until body.partsNum).map(body::getPart) }.orEmpty()
        val values =
            ContentValues().apply {
                put(Telephony.Mms.THREAD_ID, threadId)
                put(Telephony.Mms.DATE, req.date)
                put(Telephony.Mms.MESSAGE_BOX, Telephony.Mms.MESSAGE_BOX_OUTBOX)
                put(Telephony.Mms.READ, 1)
                put(Telephony.Mms.SEEN, 1)
                put(Telephony.Mms.MESSAGE_TYPE, PduHeaders.MESSAGE_TYPE_SEND_REQ)
                put(Telephony.Mms.MMS_VERSION, req.mmsVersion)
                req.transactionId?.let { put(Telephony.Mms.TRANSACTION_ID, it.ascii()) }
                req.contentType?.let { put(Telephony.Mms.CONTENT_TYPE, it.ascii()) }
                put(Telephony.Mms.MESSAGE_SIZE, req.messageSize)
                put(Telephony.Mms.SUBSCRIPTION_ID, subId)
                put(Telephony.Mms.TEXT_ONLY, if (parts.all { isInline(it.contentType.ascii().lowercase()) }) 1 else 0)
                put(Telephony.Mms.LOCKED, 0)
            }
        val uri = resolver.insert(Telephony.Mms.CONTENT_URI, values) ?: return null
        val rowId = ContentUris.parseId(uri)
        return runCatching {
            parts.forEach { insertPart(context, rowId, it, it.contentType.ascii().lowercase()) }
            val addrUri = Uri.parse("content://mms/$rowId/addr")
            val rows =
                listOf(PduHeaders.FROM_INSERT_ADDRESS_TOKEN_STR to PduHeaders.FROM) +
                    recipients.map { it to PduHeaders.TO }
            for ((address, type) in rows) {
                val addr =
                    ContentValues().apply {
                        put(Telephony.Mms.Addr.ADDRESS, address)
                        put(Telephony.Mms.Addr.TYPE, type)
                        put(Telephony.Mms.Addr.CHARSET, CharacterSets.UTF_8)
                    }
                resolver.insert(addrUri, addr)
            }
            rowId
        }.onFailure {
            Log.e(TAG, "Saving outgoing MMS $rowId failed; removing the partial row", it)
            runCatching { resolver.delete(uri, null, null) }
        }.getOrNull()
    }

    /** The message box an MMS row is in, or null when it can't be read. */
    fun box(
        context: Context,
        rowId: Long,
    ): Int? =
        runCatching {
            context.contentResolver
                .query(
                    ContentUris.withAppendedId(Telephony.Mms.CONTENT_URI, rowId),
                    arrayOf(Telephony.Mms.MESSAGE_BOX),
                    null,
                    null,
                    null,
                )?.use { if (it.moveToFirst()) it.getInt(0) else null }
        }.getOrNull()

    /** Moves an outgoing MMS to Sent or Failed once the carrier answered. */
    fun setBox(
        context: Context,
        rowId: Long,
        box: Int,
        messageId: String? = null,
    ): Boolean {
        val values =
            ContentValues().apply {
                put(Telephony.Mms.MESSAGE_BOX, box)
                messageId?.let { put(Telephony.Mms.MESSAGE_ID, it) }
                if (box == Telephony.Mms.MESSAGE_BOX_SENT) {
                    put(Telephony.Mms.DATE_SENT, System.currentTimeMillis() / MILLIS_PER_SECOND)
                }
            }
        return runCatching {
            val uri = ContentUris.withAppendedId(Telephony.Mms.CONTENT_URI, rowId)
            context.contentResolver.update(uri, values, null, null) > 0
        }.getOrDefault(false)
    }

    /** A stored outgoing MMS, read back to send it again ("Tap to retry"). */
    class Stored(
        val recipients: List<String>,
        val text: String,
        val attachments: List<MmsAttachment>,
        val subId: Int,
        val threadId: Long,
    )

    @Suppress("ReturnCount", "NestedBlockDepth") // no row, no recipients: nothing to resend; one pass over parts
    fun loadOutgoing(
        context: Context,
        rowId: Long,
    ): Stored? {
        val resolver = context.contentResolver
        val (subId, threadId) =
            resolver
                .query(
                    ContentUris.withAppendedId(Telephony.Mms.CONTENT_URI, rowId),
                    arrayOf(Telephony.Mms.SUBSCRIPTION_ID, Telephony.Mms.THREAD_ID),
                    null,
                    null,
                    null,
                )?.use { if (it.moveToFirst()) it.getInt(0) to it.getLong(1) else null } ?: return null
        val recipients = storedRecipients(context, rowId)
        if (recipients.isEmpty()) return null
        val texts = mutableListOf<String>()
        val attachments = mutableListOf<MmsAttachment>()
        resolver
            .query(
                Uri.parse("content://mms/$rowId/part"),
                arrayOf(Telephony.Mms.Part._ID, Telephony.Mms.Part.CONTENT_TYPE, Telephony.Mms.Part.TEXT),
                null,
                null,
                "${Telephony.Mms.Part.SEQ} ASC",
            )?.use { c ->
                while (c.moveToNext()) {
                    val type = c.getString(1).orEmpty().lowercase()
                    when (type) {
                        CONTENT_TYPE_TEXT -> c.getString(2)?.let { texts += it }
                        CONTENT_TYPE_SMIL -> Unit
                        else -> storedPartData(context, c.getLong(0))?.let { attachments += MmsAttachment(type, it) }
                    }
                }
            }
        return Stored(recipients, texts.joinToString("\n"), attachments, subId, threadId)
    }

    private fun storedRecipients(
        context: Context,
        rowId: Long,
    ): List<String> {
        val recipients = mutableListOf<String>()
        context.contentResolver
            .query(
                Uri.parse("content://mms/$rowId/addr"),
                arrayOf(Telephony.Mms.Addr.ADDRESS),
                "${Telephony.Mms.Addr.TYPE} = ?",
                arrayOf(PduHeaders.TO.toString()),
                null,
            )?.use { c ->
                while (c.moveToNext()) MmsParticipants.clean(c.getString(0))?.let { recipients += it }
            }
        return recipients
    }

    private fun storedPartData(
        context: Context,
        partId: Long,
    ): ByteArray? =
        context.contentResolver
            .openInputStream(Uri.parse("content://mms/part/$partId"))
            ?.use { it.readBytes() }

    private fun isInline(type: String) = type.startsWith("text/") || type == CONTENT_TYPE_SMIL

    private fun messageValues(
        conf: RetrieveConf,
        threadId: Long,
        subId: Int,
        receivedAt: Long,
        parts: List<PduPart>,
    ) = ContentValues().apply {
        put(Telephony.Mms.THREAD_ID, threadId)
        put(Telephony.Mms.DATE, receivedAt / MILLIS_PER_SECOND)
        put(Telephony.Mms.DATE_SENT, conf.date.takeIf { it > 0 } ?: (receivedAt / MILLIS_PER_SECOND))
        put(Telephony.Mms.MESSAGE_BOX, Telephony.Mms.MESSAGE_BOX_INBOX)
        put(Telephony.Mms.READ, 0)
        put(Telephony.Mms.SEEN, 0)
        put(Telephony.Mms.MESSAGE_TYPE, PduHeaders.MESSAGE_TYPE_RETRIEVE_CONF)
        put(Telephony.Mms.MMS_VERSION, conf.mmsVersion)
        conf.messageId?.let { put(Telephony.Mms.MESSAGE_ID, it.ascii()) }
        conf.transactionId?.let { put(Telephony.Mms.TRANSACTION_ID, it.ascii()) }
        conf.contentType?.let { put(Telephony.Mms.CONTENT_TYPE, it.ascii()) }
        conf.messageClass?.let { put(Telephony.Mms.MESSAGE_CLASS, it.ascii()) }
        conf.subject?.let {
            put(Telephony.Mms.SUBJECT, it.string)
            put(Telephony.Mms.SUBJECT_CHARSET, it.characterSet)
        }
        conf.priority.takeIf { it != 0 }?.let { put(Telephony.Mms.PRIORITY, it) }
        conf.deliveryReport.takeIf { it != 0 }?.let { put(Telephony.Mms.DELIVERY_REPORT, it) }
        conf.readReport.takeIf { it != 0 }?.let { put(Telephony.Mms.READ_REPORT, it) }
        put(Telephony.Mms.MESSAGE_SIZE, parts.sumOf { it.data?.size ?: 0 })
        put(Telephony.Mms.SUBSCRIPTION_ID, subId)
        val textOnly =
            parts.all { part ->
                val type = part.contentType.ascii().lowercase()
                type.startsWith("text/") || type == CONTENT_TYPE_SMIL
            }
        put(Telephony.Mms.TEXT_ONLY, if (textOnly) 1 else 0)
        put(Telephony.Mms.LOCKED, 0)
    }

    private fun insertPart(
        context: Context,
        rowId: Long,
        part: PduPart,
        type: String,
    ) {
        // Text and the layout (SMIL) live in the row; everything else in a file.
        val inline = type == CONTENT_TYPE_TEXT || type == CONTENT_TYPE_SMIL
        val values =
            partValues(part, type).apply {
                if (inline) put(Telephony.Mms.Part.TEXT, decodeText(part).orEmpty())
            }
        val partUri =
            context.contentResolver.insert(Uri.parse("content://mms/$rowId/part"), values)
                ?: error("Provider refused a part of MMS $rowId")
        if (!inline) {
            val data = part.data ?: return
            context.contentResolver.openOutputStream(partUri)?.use { it.write(data) }
                ?: error("Couldn't write the data of $partUri")
        }
    }

    private fun partValues(
        part: PduPart,
        type: String,
    ) = ContentValues().apply {
        put(Telephony.Mms.Part.CONTENT_TYPE, type)
        part.charset.takeIf { it != 0 }?.let { put(Telephony.Mms.Part.CHARSET, it) }
        part.contentId?.let { put(Telephony.Mms.Part.CONTENT_ID, it.ascii()) }
        part.contentLocation?.let { put(Telephony.Mms.Part.CONTENT_LOCATION, it.ascii()) }
        part.name?.let { put(Telephony.Mms.Part.NAME, it.ascii()) }
        part.filename?.let { put(Telephony.Mms.Part.FILENAME, it.ascii()) }
    }

    private fun insertAddresses(
        context: Context,
        rowId: Long,
        conf: RetrieveConf,
        sender: String,
    ) {
        val addrUri = Uri.parse("content://mms/$rowId/addr")
        val rows =
            listOf(sender to PduHeaders.FROM) +
                conf.to
                    .strings()
                    .mapNotNull(MmsParticipants::clean)
                    .map { it to PduHeaders.TO } +
                conf.cc
                    .strings()
                    .mapNotNull(MmsParticipants::clean)
                    .map { it to PduHeaders.CC }
        for ((address, type) in rows) {
            val values =
                ContentValues().apply {
                    put(Telephony.Mms.Addr.ADDRESS, address)
                    put(Telephony.Mms.Addr.TYPE, type)
                    put(Telephony.Mms.Addr.CHARSET, CharacterSets.UTF_8)
                }
            context.contentResolver.insert(addrUri, values)
        }
    }

    // A text part's own charset when it names one Java knows; UTF-8 otherwise.
    private fun decodeText(part: PduPart): String? {
        val data = part.data ?: return null
        val charset =
            part.charset
                .takeIf { it != 0 }
                ?.let { runCatching { CharacterSets.getMimeName(it) }.getOrNull() }
                ?.let { runCatching { charset(it) }.getOrNull() }
                ?: Charsets.UTF_8
        return String(data, charset)
    }

    /**
     * This phone's own numbers: every active SIM that reports one (often none
     * do), plus the number the user gave in Edit Profile (see OwnNumber).
     */
    @SuppressLint("MissingPermission", "HardwareIds") // READ_PHONE_NUMBERS is requested in onboarding
    @Suppress("DEPRECATION") // SubscriptionInfo.number: getPhoneNumber() only exists on API 33+
    fun selfNumbers(context: Context): List<String> =
        runCatching {
            val manager = context.getSystemService(SubscriptionManager::class.java) ?: return emptyList()
            manager.activeSubscriptionInfoList.orEmpty().mapNotNull { info ->
                val number =
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        manager.getPhoneNumber(info.subscriptionId)
                    } else {
                        info.number
                    }
                number?.takeIf { it.isNotBlank() }
            }
        }.getOrDefault(emptyList()) + listOfNotNull(OwnNumber.saved.takeIf { it.isNotBlank() })

    private fun Array<EncodedStringValue>?.strings(): List<String?> = this?.map { it.string }.orEmpty()

    private fun ByteArray?.ascii(): String = this?.let { String(it, Charsets.ISO_8859_1) }.orEmpty()
}
