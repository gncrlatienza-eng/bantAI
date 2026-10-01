package com.bantai.data.model

// Describes what a thread is about using fixed keyword topics and detected
// signals only. Unlike a generative summarizer it can only name categories it
// actually matched, so it cannot invent an amount, deadline, or claim.

private class Topic(
    val phrase: String,
    keywords: List<String>,
) {
    // Compiled once: this runs on the main thread when the Messages list is
    // regrouped, so per-call Regex construction caused an ANR.
    val pattern = keywordPattern(keywords)
}

// Whole-word match for plain words so "load" doesn't match "download" or
// "due" doesn't match "residue"; phrases/symbols match as plain substrings.
private fun keywordPattern(keywords: List<String>): Regex =
    Regex(
        keywords.joinToString("|") { keyword ->
            if (keyword.all { it.isLetterOrDigit() }) {
                "(?<![\\p{L}\\p{N}])${Regex.escape(keyword)}(?![\\p{L}\\p{N}])"
            } else {
                Regex.escape(keyword)
            }
        },
    )

private val TOPICS =
    listOf(
        Topic(
            "rewards and promos",
            listOf(
                "promo",
                "promos",
                "reward",
                "rewards",
                "points",
                "discount",
                "sale",
                "voucher",
                "freebie",
                "freebies",
                "libre",
                "offer",
                "bonus",
                "gigasurf",
                "gosurf",
                "unlimited",
                "subscribe",
                "register",
                "registered",
                "% off",
                "load",
            ),
        ),
        Topic(
            "one-time verification codes",
            listOf(
                "otp",
                "verification code",
                "one-time",
                "one time pin",
                "authentication code",
                "do not share",
                "don't share",
                "huwag ibigay",
                "huwag ibahagi",
            ),
        ),
        Topic(
            "bills and payments",
            listOf(
                "bill",
                "billing",
                "due",
                "payment",
                "paid",
                "amount due",
                "balance",
                "statement",
                "gcash",
                "maya",
                "paymaya",
                "transfer",
                "cash in",
                "cash-in",
                "received",
                "transaction",
                "bayad",
                "bayaran",
            ),
        ),
        Topic(
            "account security alerts",
            listOf(
                "login",
                "log in",
                "password",
                "suspended",
                "locked",
                "unauthorized",
                "security alert",
                "deactivated",
                "update your",
                "verify your account",
            ),
        ),
        Topic(
            "deliveries and orders",
            listOf(
                "parcel",
                "package",
                "delivery",
                "deliver",
                "courier",
                "shipment",
                "shipped",
                "rider",
                "tracking",
                "order",
                "lbc",
                "j&t",
                "jnt",
                "shopee",
                "lazada",
                "out for delivery",
            ),
        ),
        Topic(
            "prizes and winnings",
            listOf(
                "won",
                "winner",
                "prize",
                "congratulations",
                "claim",
                "raffle",
                "jackpot",
                "panalo",
                "nanalo",
                "cash prize",
                "you are selected",
            ),
        ),
        // NDRRMC/PAGASA/PHIVOLCS advisories are Tagalog-first, so the English
        // topics above never matched them.
        Topic(
            "disaster and weather alerts",
            listOf(
                "bagyo",
                "bagyong",
                "typhoon",
                "storm surge",
                "signal no",
                "lindol",
                "earthquake",
                "tsunami",
                "baha",
                "pagbaha",
                "flood",
                "flooding",
                "landslide",
                "pagguho",
                "bulkan",
                "bulkang",
                "volcano",
                "pagputok",
                "eruption",
                "lumikas",
                "evacuate",
                "evacuation",
                "rainfall warning",
                "pag-ulan",
                "habagat",
                "amihan",
                "heat index",
                "pagasa",
                "phivolcs",
                "ndrrmc",
                "walang pasok",
                "class suspension",
            ),
        ),
        Topic(
            "public service announcements",
            listOf(
                "paalala",
                "paalaala",
                "abiso",
                "census",
                "sim registration",
                "ntc",
                "dict",
                "comelec",
                "botante",
                "halalan",
                "bakuna",
                "vaccine",
                "public advisory",
                "psa",
                "bureau of fire protection",
            ),
        ),
        Topic("loans", listOf("loan", "loans", "utang", "pre-approved", "lending", "credit limit", "pautang")),
        Topic(
            "job offers",
            listOf(
                "hiring",
                "job",
                "salary",
                "sahod",
                "part-time",
                "work from home",
                "commission",
                "recruitment",
                "daily income",
                "earn",
            ),
        ),
        Topic(
            "plans and reminders",
            listOf(
                "reminder",
                "schedule",
                "appointment",
                "meeting",
                "tomorrow",
                "bukas",
                "mamaya",
                "tonight",
                "see you",
            ),
        ),
    )

private val LINK_REGEX = Regex("https?://|www\\.|bit\\.ly|tinyurl", RegexOption.IGNORE_CASE)
private val MONEY_REGEX = Regex("₱\\s?\\d|\\bphp\\s?\\d|\\bp\\s?\\d[\\d,]*\\d", RegexOption.IGNORE_CASE)
private val CODE_REGEX = Regex("(?<!\\d)\\d{4,8}(?!\\d)")
private val DEADLINE_REGEX =
    keywordPattern(
        // Not bare "hanggang" ("until"): NDRRMC uses it for time ranges ("3:01PM hanggang 3:13PM").
        listOf("expire", "expires", "expiring", "valid until", "deadline", "last day", "today only", "ngayon lang"),
    )
private val PHONE_SENDER_REGEX = Regex("^[+\\d\\s\\-()]+$")

private fun topicCounts(messages: List<SmsMessage>): List<Pair<Topic, Int>> {
    val bodies = messages.map { it.body.lowercase() }
    return TOPICS
        .map { topic -> topic to bodies.count { body -> topic.pattern.containsMatchIn(body) } }
        .filter { it.second > 0 }
        .sortedByDescending { it.second }
}

private fun coverageWord(
    count: Int,
    total: Int,
): String =
    when {
        total == 1 -> ""
        count == total -> "all "
        count * 2 >= total -> "mostly "
        else -> "partly "
    }

/**
 * Short phrase for the unread preview, e.g. "Mostly about rewards and promos".
 * Null when no topic matched.
 */
fun threadTopicPhrase(messages: List<SmsMessage>): String? {
    val (topic, count) = topicCounts(messages).firstOrNull() ?: return null
    return "${coverageWord(count, messages.size)}about ${topic.phrase}".replaceFirstChar { it.uppercase() }
}

/**
 * Plain-language description of what a thread is about, e.g. "Messages from
 * GLOBE are mostly about rewards and promos, with some about bills and
 * payments. They include links and mention money amounts."
 *
 * @param messagesOldestFirst incoming messages of the thread.
 * @return null when there is nothing to describe.
 */
@Suppress("CyclomaticComplexMethod") // one branch per topic pattern, kept flat for readability
fun describeThread(
    messagesOldestFirst: List<SmsMessage>,
    sender: String,
): String? {
    val messages = messagesOldestFirst.filter { it.body.isNotBlank() }
    if (messages.isEmpty()) return null
    val total = messages.size
    val single = total == 1
    val isPhoneNumber = PHONE_SENDER_REGEX.matches(sender.trim())
    val source =
        when {
            single && isPhoneNumber -> "This message"
            single -> "This message from $sender"
            isPhoneNumber -> "Messages from this number"
            else -> "Messages from $sender"
        }
    val verb = if (single) "is" else "are"
    val pronoun = if (single) "It" else "They"
    val bodies = messages.map { it.body.lowercase() }

    val sentences = mutableListOf<String>()
    val topics = topicCounts(messages)
    if (topics.isEmpty()) {
        sentences +=
            when {
                isPhoneNumber && single -> "This looks like a personal message."
                isPhoneNumber -> "This looks like a personal conversation."
                single -> "BantAI couldn't find a common topic in this message."
                else -> "BantAI couldn't find a common topic in these messages."
            }
    } else {
        val (top, topCount) = topics[0]
        var line = "$source $verb ${coverageWord(topCount, total)}about ${top.phrase}"
        val second = topics.getOrNull(1)
        if (second != null && !single) line += ", with some about ${second.first.phrase}"
        sentences += "$line."
    }

    val signals = mutableListOf<String>()
    if (bodies.any { LINK_REGEX.containsMatchIn(it) }) signals += "include${if (single) "s" else ""} links"
    if (bodies.any { MONEY_REGEX.containsMatchIn(it) }) signals += "mention${if (single) "s" else ""} money amounts"
    if (bodies.any { DEADLINE_REGEX.containsMatchIn(it) }) {
        signals += "mention${if (single) "s" else ""} a deadline"
    }
    if (signals.isNotEmpty()) sentences += "$pronoun ${joinNaturally(signals)}."

    val hasCode =
        topics.any { it.first.phrase == "one-time verification codes" } &&
            bodies.any { CODE_REGEX.containsMatchIn(it) }
    if (hasCode) sentences += "A verification code is included. Never share it with anyone."

    val spam = messages.count { it.classification == Classification.SPAM }
    val review = messages.count { it.classification.isFlagged }
    if (spam > 0) sentences += "BantAI marked ${countPhrase(spam, total)} as spam."
    if (review > 0) sentences += "BantAI flagged ${countPhrase(review, total)} for review."

    return sentences.joinToString(" ")
}

private fun countPhrase(
    count: Int,
    total: Int,
): String =
    when {
        total == 1 -> "this message"
        count == total -> "all of them"
        else -> "$count of them"
    }

private fun joinNaturally(items: List<String>): String =
    when (items.size) {
        1 -> items[0]
        2 -> "${items[0]} and ${items[1]}"
        else -> items.dropLast(1).joinToString(", ") + ", and " + items.last()
    }
