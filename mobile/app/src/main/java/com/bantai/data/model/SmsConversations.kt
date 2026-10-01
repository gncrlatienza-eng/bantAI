package com.bantai.data.model

// Collapses individual SMS rows into one entry per sender, the way every real
// messaging app groups a conversation instead of listing each text separately.
// `messages` must already be sorted newest-first (SmsRepository queries are
// DATE DESC), so the first row seen per sender supplies the row identity and
// timestamp. When a thread has multiple unread messages, the row instead gets
// a local extractive preview of that unread batch; otherwise it keeps the
// newest SMS body as its preview. The row is marked unread if any message in
// that sender's group is unread.
fun List<SmsMessage>.groupedBySenderLatest(summarizeUnread: Boolean = true): List<SmsMessage> {
    val latestBySender = LinkedHashMap<String, SmsMessage>()
    val hasUnreadBySender = mutableMapOf<String, Boolean>()
    val unreadBySender = mutableMapOf<String, MutableList<SmsMessage>>()

    for (msg in this) {
        val key = msg.conversationKey
        latestBySender.putIfAbsent(key, msg)
        hasUnreadBySender[key] = (hasUnreadBySender[key] ?: false) || !msg.isRead
        if (!msg.isRead) unreadBySender.getOrPut(key) { mutableListOf() }.add(msg)
    }

    return latestBySender.map { (key, msg) ->
        val unread = unreadBySender[key].orEmpty()
        val summary = if (summarizeUnread) summarizeUnreadThread(unread) else null
        msg.copy(
            // A group's row is the group, not whoever wrote last: opening,
            // deleting or muting it acts on the whole thread.
            sender = if (msg.groupThreadId != null) key else msg.sender,
            body = summary ?: msg.body,
            isRead = !(hasUnreadBySender[key] ?: false),
            isUnreadThreadSummary = summary != null,
        )
    }
}

private const val GROUP_KEY_PREFIX = "group:"
private const val GROUP_TITLE_NAMES = 3

/** The conversation key of a group thread (see [conversationKey]). */
fun groupKey(threadId: Long): String = "$GROUP_KEY_PREFIX$threadId"

/** The thread id in a group key; null for a 1:1 key (a phone number or sender ID). */
fun groupThreadIdOf(key: String): Long? {
    if (!key.startsWith(GROUP_KEY_PREFIX)) return null
    return key.removePrefix(GROUP_KEY_PREFIX).toLongOrNull()
}

fun isGroupKey(key: String): Boolean = groupThreadIdOf(key) != null

/** "Ana, Ben and Carl", or "Ana, Ben, Carl +2" for bigger groups. */
fun groupTitle(names: List<String>): String =
    when {
        names.isEmpty() -> "Group"
        names.size == 1 -> names.single()
        names.size <= GROUP_TITLE_NAMES -> names.dropLast(1).joinToString(", ") + " and " + names.last()
        else -> names.take(GROUP_TITLE_NAMES).joinToString(", ") + " +${names.size - GROUP_TITLE_NAMES}"
    }

/**
 * Which slice of a sender's messages is shown: the inbox chips place each
 * message by its own verdict, so a sender that mixes OTPs with promos appears
 * in both Messages and Spam, and opening it from a chip shows only that
 * chip's messages. The user's own sent messages appear in every view so a
 * reply (e.g. a promo keyword to 8080) keeps its context. Blocked scams live
 * only in Alerts.
 */
private val HIDDEN_FROM_MESSAGES = setOf(Classification.SPAM, Classification.UNKNOWN, Classification.SCAM)

enum class ConversationView(
    val routeValue: String,
) {
    ALL("all"),
    MESSAGES("messages"),
    SPAM("spam"),
    UNKNOWN("unknown"),

    /**
     * Only this sender's messages in Recently Deleted. MessageDetailViewModel
     * loads exactly those rows for this view, so [includes] passes them all.
     * Opening a Recently Deleted row used to show the rest of the conversation
     * (everything *but* the deleted messages), which looked like a duplicate.
     */
    DELETED("deleted"),
    ;

    fun includes(message: SmsMessage): Boolean =
        when (this) {
            ALL -> true
            MESSAGES -> message.isOutgoing || message.classification !in HIDDEN_FROM_MESSAGES
            SPAM -> message.isOutgoing || message.classification == Classification.SPAM
            UNKNOWN -> message.isOutgoing || message.classification == Classification.UNKNOWN
            DELETED -> true
        }

    companion object {
        fun fromRoute(value: String?): ConversationView = entries.firstOrNull { it.routeValue == value } ?: ALL
    }
}

// Strips whitespace, hyphens, and parentheses so "+63 917-123-4567" and
// "+639171234567" collapse into the same conversation, matching the
// normalization SmsReceiver already applies when storing incoming messages.
// Compiled once: this runs for every message on every regroup of the inbox.
private val SENDER_SEPARATORS = Regex("[\\s\\-()]")
private val PH_MOBILE_LOCAL = Regex("^09\\d{9}$")
private val PH_MOBILE_NO_PLUS = Regex("^639\\d{9}$")
private val PH_MOBILE_BARE = Regex("^9\\d{9}$")

/**
 * One key per person. Besides formatting, a PH mobile number arrives as
 * "+639171234567" but is usually typed as "09171234567": those used to be two
 * different conversations, so a thread started from Compose never showed the
 * other person's replies. All PH mobile forms now collapse to "+639...".
 */
fun normalizeSenderKey(address: String): String {
    if (isGroupKey(address)) return address
    val stripped = address.replace(SENDER_SEPARATORS, "")
    return when {
        PH_MOBILE_LOCAL.matches(stripped) -> "+63" + stripped.drop(1)
        PH_MOBILE_NO_PLUS.matches(stripped) -> "+$stripped"
        PH_MOBILE_BARE.matches(stripped) -> "+63$stripped"
        else -> stripped
    }
}

/** The ADDRESS spellings the SMS database may hold for this person (for exact-match queries). */
fun addressVariants(address: String): List<String> {
    val key = normalizeSenderKey(address)
    val variants = linkedSetOf(address, address.replace(SENDER_SEPARATORS, ""), key)
    if (key.startsWith("+639") && key.length == PH_E164_LENGTH) {
        variants += "0" + key.drop(PH_COUNTRY_PREFIX.length)
        variants += key.drop(1)
    }
    return variants.toList()
}

private const val PH_E164_LENGTH = 13
private const val PH_COUNTRY_PREFIX = "+63"

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
