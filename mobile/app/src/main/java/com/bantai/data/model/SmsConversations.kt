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

// Strips whitespace, hyphens, and parentheses so "+63 917-123-4567" and
// "+639171234567" collapse into the same conversation, matching the
// normalization SmsReceiver already applies when storing incoming messages.
fun normalizeSenderKey(address: String): String = address.replace(Regex("[\\s\\-()]"), "")

private const val MINIMUM_UNREAD_MESSAGES_FOR_SUMMARY = 2
private const val MAXIMUM_SUMMARY_SENTENCES = 2
private const val MAXIMUM_SUMMARY_CHARACTERS = 220

/**
 * Produces a small TF-IDF-style extractive summary entirely in memory.
 *
 * The input is newest-first because it comes from the SMS provider. Sentences
 * are selected by their distinctive terms, then restored to chronological
 * order so the preview reads naturally. This intentionally does not use a
 * network model or persist a derived copy of the message content.
 */
fun summarizeUnreadThread(messages: List<SmsMessage>): String? {
    if (messages.count { !it.isRead } < MINIMUM_UNREAD_MESSAGES_FOR_SUMMARY) return null

    val sentences =
        messages
            .asReversed()
            .flatMap { message -> splitSentences(message.body) }
            .filter { it.isNotBlank() }
    if (sentences.size < 2) return null

    val tokenized = sentences.map(::meaningfulTokens)
    val documentFrequency = mutableMapOf<String, Int>()
    tokenized.forEach { tokens ->
        tokens.toSet().forEach { token ->
            documentFrequency[token] = (documentFrequency[token] ?: 0) + 1
        }
    }
    val documentCount = sentences.size.toDouble()

    val selectedIndices =
        sentences.indices
            .map { index ->
                val tokens = tokenized[index]
                val score =
                    if (tokens.isEmpty()) {
                        0.0
                    } else {
                        tokens.sumOf { token ->
                            val idf =
                                kotlin.math.ln(
                                    (documentCount + 1) / ((documentFrequency[token] ?: 0) + 1),
                                ) + 1
                            idf
                        } / tokens.size
                    }
                index to score
            }.sortedWith(
                compareByDescending<Pair<Int, Double>> { it.second }
                    .thenBy { it.first },
            ).take(MAXIMUM_SUMMARY_SENTENCES)
            .map { it.first }
            .sorted()

    val summary = selectedIndices.joinToString(" ") { sentences[it] }.trim()
    return summary.take(MAXIMUM_SUMMARY_CHARACTERS).trim().takeIf { it.isNotBlank() }
}

private fun splitSentences(body: String): List<String> =
    body
        .replace(Regex("\\s+"), " ")
        .trim()
        .split(Regex("(?<=[.!?])\\s+"))
        .map(String::trim)
        .filter(String::isNotBlank)

private fun meaningfulTokens(text: String): List<String> =
    TOKEN_REGEX
        .findAll(text.lowercase())
        .map { it.value }
        .filterNot { it in SUMMARY_STOP_WORDS }
        .toList()

private val TOKEN_REGEX = Regex("[\\p{L}\\p{N}]{2,}")

// Small bilingual stop-word list keeps common function words from winning the
// extraction score while avoiding a bulky NLP dependency in the Android app.
private val SUMMARY_STOP_WORDS =
    setOf(
        "a",
        "an",
        "and",
        "are",
        "as",
        "at",
        "be",
        "but",
        "by",
        "for",
        "from",
        "has",
        "have",
        "in",
        "is",
        "it",
        "of",
        "on",
        "or",
        "that",
        "the",
        "this",
        "to",
        "was",
        "were",
        "will",
        "with",
        "you",
        "your",
        "ang",
        "at",
        "ay",
        "ba",
        "dahil",
        "ito",
        "ka",
        "ko",
        "kung",
        "mga",
        "na",
        "ng",
        "para",
        "po",
        "sa",
        "si",
        "sila",
        "tayo",
        "yung",
    )
