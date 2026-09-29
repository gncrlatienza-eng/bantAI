package com.bantai.data.model

// Collapses individual SMS rows into one entry per sender, the way every real
// messaging app groups a conversation instead of listing each text separately.
// `messages` must already be sorted newest-first (SmsRepository queries are
// DATE DESC), so the first row seen per sender supplies the row identity and
// timestamp. When a thread has multiple unread messages, the row instead gets
// a local extractive preview of that unread batch; otherwise it keeps the
// newest SMS body as its preview. The row is marked unread if any message in
// that sender's group is unread.
fun List<SmsMessage>.groupedBySenderLatest(): List<SmsMessage> {
    val latestBySender = LinkedHashMap<String, SmsMessage>()
    val hasUnreadBySender = mutableMapOf<String, Boolean>()
    val unreadBySender = mutableMapOf<String, MutableList<SmsMessage>>()

    for (msg in this) {
        val key = normalizeSenderKey(msg.sender)
        latestBySender.putIfAbsent(key, msg)
        hasUnreadBySender[key] = (hasUnreadBySender[key] ?: false) || !msg.isRead
        if (!msg.isRead) unreadBySender.getOrPut(key) { mutableListOf() }.add(msg)
    }

    return latestBySender.map { (key, msg) ->
        val unread = unreadBySender[key].orEmpty()
        val summary = summarizeUnreadThread(unread)
        msg.copy(
            body = summary ?: msg.body,
            isRead = !(hasUnreadBySender[key] ?: false),
            isUnreadThreadSummary = summary != null,
        )
    }
}

/**
 * Which slice of a sender's messages is shown: the inbox chips place each
 * message by its own verdict, so a sender that mixes OTPs with promos appears
 * in both Messages and Spam, and opening it from a chip shows only that
 * chip's messages. The user's own sent messages appear in every view so a
 * reply (e.g. a promo keyword to 8080) keeps its context. Blocked scams live
 * only in Alerts.
 */
enum class ConversationView(
    val routeValue: String,
) {
    ALL("all"),
    MESSAGES("messages"),
    SPAM("spam"),
    UNKNOWN("unknown"),
    ;

    fun includes(message: SmsMessage): Boolean =
        when (this) {
            ALL -> true
            MESSAGES -> message.isOutgoing || message.classification !in setOf("spam", "unknown", "blocked")
            SPAM -> message.isOutgoing || message.classification == "spam"
            UNKNOWN -> message.isOutgoing || message.classification == "unknown"
        }

    companion object {
        fun fromRoute(value: String?): ConversationView = entries.firstOrNull { it.routeValue == value } ?: ALL
    }
}

// Strips whitespace, hyphens, and parentheses so "+63 917-123-4567" and
// "+639171234567" collapse into the same conversation, matching the
// normalization SmsReceiver already applies when storing incoming messages.
fun normalizeSenderKey(address: String): String = address.replace(Regex("[\\s\\-()]"), "")

private const val MINIMUM_UNREAD_MESSAGES_FOR_SUMMARY = 2
private const val MAXIMUM_SUMMARY_SENTENCES = 2
private const val MAXIMUM_SUMMARY_CHARACTERS = 220

/**
 * Unread-preview variant used by the Messages list. The input is newest-first
 * because it comes from the SMS provider; it's reversed before summarizing.
 */
fun summarizeUnreadThread(messages: List<SmsMessage>): String? {
    if (messages.count { !it.isRead } < MINIMUM_UNREAD_MESSAGES_FOR_SUMMARY) return null
    val topic = threadTopicPhrase(messages)?.let { "$it." }
    val extract =
        summarizeThread(
            messages.asReversed(),
            maxSentences = MAXIMUM_SUMMARY_SENTENCES,
            maxChars = MAXIMUM_SUMMARY_CHARACTERS,
        )
    return listOfNotNull(topic, extract)
        .joinToString(" ")
        .take(MAXIMUM_SUMMARY_CHARACTERS)
        .trim()
        .takeIf { it.isNotBlank() }
}
