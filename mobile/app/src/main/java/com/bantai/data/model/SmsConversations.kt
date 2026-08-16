package com.bantai.data.model

// Collapses individual SMS rows into one entry per sender, the way every real
// messaging app groups a conversation instead of listing each text separately.
// `messages` must already be sorted newest-first (SmsRepository queries are
// DATE DESC), so the first row seen per sender is the one shown as the preview;
// the row is marked unread if any message in that sender's group is unread.
fun List<SmsMessage>.groupedBySenderLatest(): List<SmsMessage> {
    val latestBySender = LinkedHashMap<String, SmsMessage>()
    val hasUnreadBySender = mutableMapOf<String, Boolean>()

    for (msg in this) {
        val key = normalizeSenderKey(msg.sender)
        latestBySender.putIfAbsent(key, msg)
        hasUnreadBySender[key] = (hasUnreadBySender[key] ?: false) || !msg.isRead
    }

    return latestBySender.map { (key, msg) -> msg.copy(isRead = !(hasUnreadBySender[key] ?: false)) }
}

// Strips whitespace, hyphens, and parentheses so "+63 917-123-4567" and
// "+639171234567" collapse into the same conversation, matching the
// normalization SmsReceiver already applies when storing incoming messages.
fun normalizeSenderKey(address: String): String = address.replace(Regex("[\\s\\-()]"), "")
