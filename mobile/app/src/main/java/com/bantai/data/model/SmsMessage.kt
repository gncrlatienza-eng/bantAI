package com.bantai.data.model

data class SmsMessage(
    val id: Long = 0,
    val sender: String = "",
    val body: String = "",
    val timestamp: Long = 0L,
    val classification: String = "safe",
    val isContact: Boolean = false,
    val isOutgoing: Boolean = false,
    val isRead: Boolean = true,
)
