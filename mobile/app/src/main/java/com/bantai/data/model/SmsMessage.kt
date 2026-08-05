package com.bantai.data.model

// Mirrors Telephony.Sms.TYPE for outgoing messages — NONE covers incoming
// messages (status doesn't apply) and any outgoing type we don't specially
// render (e.g. MESSAGE_TYPE_QUEUED folds into SENDING, see SmsRepository).
enum class SendStatus { NONE, SENDING, SENT, FAILED }

data class SmsMessage(
    val id: Long = 0,
    val sender: String = "",
    val body: String = "",
    val timestamp: Long = 0L,
    val classification: String = "safe",
    val isContact: Boolean = false,
    val isOutgoing: Boolean = false,
    val isRead: Boolean = true,
    val sendStatus: SendStatus = SendStatus.NONE,
)
