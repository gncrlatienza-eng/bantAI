package com.bantai.data.model

import com.bantai.data.db.ReplyQuoteEntity
import kotlin.math.abs

// A sent row is written within a moment of the send (OUTBOX insert, or the
// SENT fallback after the carrier answers, bounded by SmsSender's 20s timeout
// plus its late-result window), so a generous window still can't reach another
// identical text sent later in the same thread.
private const val QUOTE_MATCH_WINDOW_MS = 3 * 60_000L

/**
 * Pairs each outgoing message with the reply quote saved when it was sent:
 * same text, sent within [QUOTE_MATCH_WINDOW_MS]. Each quote is used once, by
 * the closest message in time, so resending the same words isn't quoted twice.
 */
fun matchReplyQuotes(
    conversation: List<SmsMessage>,
    quotes: List<ReplyQuoteEntity>,
): Map<Long, ReplyQuoteEntity> {
    if (quotes.isEmpty()) return emptyMap()
    val result = mutableMapOf<Long, ReplyQuoteEntity>()
    val unused = quotes.toMutableList()
    for (msg in conversation.filter { it.isOutgoing }.sortedBy { it.timestamp }) {
        val best =
            unused
                .filter { it.body == msg.body && abs(it.sentAt - msg.timestamp) <= QUOTE_MATCH_WINDOW_MS }
                .minByOrNull { abs(it.sentAt - msg.timestamp) }
                ?: continue
        result[msg.id] = best
        unused -= best
    }
    return result
}
