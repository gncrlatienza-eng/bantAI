package com.bantai.data.model

// Mirrors Telephony.Sms.TYPE for outgoing messages — NONE covers incoming
// messages (status doesn't apply) and any outgoing type we don't specially
// render (e.g. MESSAGE_TYPE_QUEUED folds into SENDING, see SmsRepository).
enum class SendStatus { NONE, SENDING, SENT, FAILED }

/**
 * What a picture message (MMS) holds beyond [SmsMessage.body], which keeps
 * "[Photo]"-style labels so list previews and notifications have something
 * to say. The thread shows [images] (content://mms/part/... URIs) and [text]
 * instead.
 */
data class MmsContent(
    val text: String,
    val images: List<String>,
)

/** How a not-yet-downloaded MMS is shown in the thread (see MmsDownloader). */
enum class MmsDownloadState { DOWNLOADING, FAILED, EXPIRED }

/** An MMS still on the carrier's server: drawn as a "Tap to download" bubble. */
data class PendingMmsDownload(
    val state: MmsDownloadState,
    val sizeBytes: Long,
)

data class SmsMessage(
    val id: Long = 0,
    val sender: String = "",
    val body: String = "",
    val timestamp: Long = 0L,
    val classification: Classification = Classification.SAFE,
    val isContact: Boolean = false,
    val isOutgoing: Boolean = false,
    val isRead: Boolean = true,
    val sendStatus: SendStatus = SendStatus.NONE,
    // This is a presentation-only value created while grouping an inbox. It is
    // never written to the device SMS provider and never leaves the device.
    val isUnreadThreadSummary: Boolean = false,
    // The SIM a message came in on (-1 when unknown), so a reply goes out on
    // the same SIM on dual-SIM phones.
    val subId: Int = -1,
    // The saved contact's name for [sender], when there is one. Filled in for
    // display by the list/thread, never stored.
    val displayName: String? = null,
    // Set only for an MMS that has pictures (see MmsReader).
    val mms: MmsContent? = null,
    // Set only for an MMS that isn't downloaded yet.
    val mmsDownload: PendingMmsDownload? = null,
    // The carrier confirmed it reached the other phone (delivery reports on).
    val delivered: Boolean = false,
    // The phone's thread id when this MMS belongs to a group conversation
    // (more than one other person); null for every 1:1 message.
    val groupThreadId: Long? = null,
)

/**
 * Which conversation a message belongs to: a group thread's key, or the
 * normalized sender for a 1:1 thread. Everything keyed by "sender" (routes,
 * drafts, notifications, deletes) takes this value.
 */
val SmsMessage.conversationKey: String
    get() = groupThreadId?.let(::groupKey) ?: normalizeSenderKey(sender)
