package com.bantai.data.model

/**
 * BantAI's verdict on one message. [storage] is the value kept in the
 * classifications table, unchanged from the strings used before this enum
 * existed, so labels already on a phone keep their meaning.
 */
enum class Classification(
    val storage: String,
) {
    /** A genuine backend/model verdict that the message is fine. */
    SAFE("safe"),

    /** Nothing suspicious found locally, but no model ever checked it. Never shown as "safe". */
    UNVERIFIED("unverified"),

    SPAM("spam"),

    /** Possibly a scam; the user should review it. */
    UNKNOWN("unknown"),

    /**
     * Smishing: a confident scam verdict, or a message from a sender already
     * blocked server-side. Hidden from threads and surfaced in Alerts.
     */
    SCAM("blocked"),
    ;

    val isFlagged: Boolean get() = this == SCAM || this == UNKNOWN

    companion object {
        private val byStorage = entries.associateBy { it.storage }

        fun fromStorage(value: String?): Classification? = value?.let(byStorage::get)
    }
}
