package com.bantai.data.db

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/** A message Android wouldn't let BantAI store in the SMS database (see LocalMessageStore). */
@Entity(tableName = "local_messages", indices = [Index("address")])
data class LocalMessageEntity(
    @PrimaryKey val id: Long,
    val address: String,
    val body: String,
    val date: Long,
    val type: Int,
    val read: Boolean,
    @ColumnInfo(name = "sub_id") val subId: Int,
)

/** A read mark or delete Android refused for a real SMS/MMS row, kept so it still takes effect. */
@Entity(tableName = "message_overrides", primaryKeys = ["message_id", "kind"])
data class MessageOverrideEntity(
    @ColumnInfo(name = "message_id") val messageId: Long,
    val kind: String,
) {
    companion object {
        const val READ = "read"
        const val DELETED = "deleted"
    }
}

/**
 * Who an MMS is from (incoming) or to (sent). Reading it takes one provider
 * query per MMS, and it never changes, so it's remembered here.
 */
@Entity(tableName = "mms_addresses")
data class MmsAddressEntity(
    @PrimaryKey @ColumnInfo(name = "mms_id") val mmsId: Long,
    val address: String,
)

/**
 * The message a sent SMS was a reply to. SMS has no reply field, so this is
 * shown on this phone only; the recipient gets plain text. Matched to the sent
 * bubble by conversation, body and send time (see MessageDetailViewModel).
 */
@Entity(tableName = "reply_quotes", indices = [Index("address_key")])
data class ReplyQuoteEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "address_key") val addressKey: String,
    val body: String,
    @ColumnInfo(name = "sent_at") val sentAt: Long,
    @ColumnInfo(name = "quoted_outgoing") val quotedOutgoing: Boolean,
    @ColumnInfo(name = "quoted_body") val quotedBody: String,
)

/**
 * An incoming MMS the carrier announced but that isn't downloaded yet (see
 * MmsDownloader). The message itself only exists on the carrier's server until
 * then, so this is what the "Tap to download" bubble is drawn from. Once the
 * MMS is saved to the phone's message store the row is kept as [COMPLETED]
 * (hidden, pruned after a while) rather than deleted: [contentLocation] is
 * unique, and that is the only thing stopping a notification the carrier sends
 * again after the download (acknowledge() is best effort) from downloading,
 * saving and notifying the same MMS twice.
 */
@Entity(tableName = "pending_mms", indices = [Index("content_location", unique = true)])
data class PendingMmsEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "content_location") val contentLocation: String,
    @ColumnInfo(name = "transaction_id") val transactionId: String,
    val sender: String,
    @ColumnInfo(name = "sub_id") val subId: Int,
    @ColumnInfo(name = "size_bytes") val sizeBytes: Long,
    /** When the carrier deletes it (millis); 0 when the notification didn't say. */
    @ColumnInfo(name = "expires_at") val expiresAt: Long,
    @ColumnInfo(name = "received_at") val receivedAt: Long,
    /** When the latest download attempt started (millis). */
    @ColumnInfo(name = "attempted_at") val attemptedAt: Long = receivedAt,
    val state: String = DOWNLOADING,
    val attempts: Int = 1,
) {
    companion object {
        const val DOWNLOADING = "downloading"
        const val FAILED = "failed"
        const val EXPIRED = "expired"
        const val COMPLETED = "completed"
    }
}

/** The backend/model verdict for one message; the SMS provider has no column for it. */
@Entity(tableName = "classifications")
data class ClassificationEntity(
    @PrimaryKey @ColumnInfo(name = "message_id") val messageId: Long,
    val label: String,
    val source: String? = null,
    @ColumnInfo(name = "model_version") val modelVersion: String? = null,
    @ColumnInfo(name = "model_sha256") val modelSha256: String? = null,
    val score: Double? = null,
    @ColumnInfo(name = "classified_at") val classifiedAt: Long? = null,
)
