package com.bantai.mms

import com.bantai.data.model.normalizeSenderKey

private const val PLMN_SUFFIX = "/TYPE=PLMN"

// What an MMS carries in place of this phone's own number when it doesn't know it.
private const val ADDRESS_TOKEN = "insert-address-token"

/**
 * Who an incoming MMS involves besides this phone. Kept free of Android types
 * so the group/1:1 decision is unit tested (MmsParticipantsTest).
 */
object MmsParticipants {
    /** An MMS address as the rest of the app spells it; null for placeholders. */
    fun clean(address: String?): String? =
        address
            ?.trim()
            ?.removeSuffix(PLMN_SUFFIX)
            ?.takeIf { it.isNotBlank() && !it.equals(ADDRESS_TOKEN, ignoreCase = true) }

    /**
     * Everyone in the conversation except this phone, sender first, one entry
     * per person. More than one entry means a group conversation.
     *
     * [selfNumbers] often comes back empty: many PH SIMs don't report their own
     * number. Then this phone can't be picked out of the recipients by number,
     * so an MMS addressed to exactly one number (no Cc) is taken to be to this
     * phone alone -- a 1:1 message. Anything addressed to two or more numbers is
     * a group, and one of those numbers is this phone's; with no way to tell
     * which, it's left in rather than guessing (Phase 5 sending must not reply
     * to itself, see MmsSender).
     */
    fun others(
        from: String?,
        to: List<String?>,
        cc: List<String?>,
        selfNumbers: Collection<String>,
    ): List<String> {
        val self = selfNumbers.mapNotNullTo(mutableSetOf()) { clean(it)?.let(::normalizeSenderKey) }
        val sender = clean(from)
        val recipients = (to + cc).mapNotNull(::clean)
        // Addressed to one number only: that's this phone, whatever it's called.
        val others = if (recipients.size <= 1) listOfNotNull(sender) else listOfNotNull(sender) + recipients
        val seen = mutableSetOf<String>()
        return others.filter { address ->
            val key = normalizeSenderKey(address)
            key !in self && seen.add(key)
        }
    }

    fun isGroup(others: List<String>): Boolean = others.size > 1
}
