package com.bantai.data.model

import com.bantai.data.remote.SmsApi
import kotlin.math.ln
import kotlin.math.sqrt

/**
 * On-device campaign grouping for the Campaigns tab. Every phone builds its own
 * view from the scam messages in its own inbox, so two phones on the same
 * account (or two users) see different campaigns.
 *
 * Two passes:
 *  1. Messages the AI matched to a known campaign (IngestResult.campaign) are
 *     grouped by that campaign. Promo campaigns are hidden.
 *  2. Messages with no match are grouped locally: first by a shared link
 *     domain, then by similar wording (TF-IDF cosine). A group needs at least
 *     [MIN_LOCAL_GROUP_SIZE] messages; anything left is "unmatched".
 * Both kinds then share one list of category sections ("Bank phishing" holds
 * the AI's BDO campaign and a BDO-lookalike blast found only on this phone
 * alike) -- to the user they're the same thing, a scam wave of that kind.
 *
 * Pure Kotlin, no Android types, so it is covered by LocalCampaignsTest.
 */

data class LocalScamMessage(
    val id: Long,
    val sender: String,
    val body: String,
    val timestamp: Long,
    val match: SmsApi.CampaignMatch?,
    /** Local classification; "blocked" scams are hidden from threads and open as alerts. */
    val classification: String = "unknown",
)

enum class GroupReason { AI_MATCH, SAME_LINK, SIMILAR_WORDING }

data class LocalCampaign(
    val key: String,
    val title: String,
    val category: String,
    val reason: GroupReason,
    /** The backend CampaignCluster id; null for groups formed only on this phone. */
    val clusterId: String?,
    val messages: List<LocalScamMessage>,
) {
    val senderCount: Int get() = messages.map { normalizeSenderKey(it.sender) }.distinct().size
    val latestTimestamp: Long get() = messages.maxOf { it.timestamp }
}

data class CategorySection(
    val category: String,
    val campaigns: List<LocalCampaign>,
) {
    val messageCount: Int get() = campaigns.sumOf { it.messages.size }
}

data class LocalCampaignOverview(
    /** All campaigns -- AI-matched and found on this phone -- one section per category, largest first. */
    val sections: List<CategorySection>,
    /** Scam messages that fit no campaign and no local group. */
    val unmatched: List<LocalScamMessage>,
    /** Messages matched to Promo / marketing campaigns, hidden from the tab. */
    val hiddenPromoCount: Int,
) {
    /** Groups found only on this phone (shared link / similar wording); already inside [sections]. */
    val localGroups: List<LocalCampaign> get() = sections.flatMap { it.campaigns }.filter { it.clusterId == null }

    val isEmpty: Boolean get() = sections.isEmpty() && unmatched.isEmpty()
}

const val PROMO_CATEGORY = "Promo / marketing"
const val OTHER_SCAM_CATEGORY = "Other scam"
const val MIN_LOCAL_GROUP_SIZE = 2

// Cosine over TF-IDF weights; 0.45 groups reworded copies of one blast
// ("Your GCash is on hold, verify at...") without pulling in merely
// same-topic messages. Tuned against the LocalCampaignsTest fixtures.
internal const val SIMILAR_WORDING_THRESHOLD = 0.45

fun buildLocalCampaigns(messages: List<LocalScamMessage>): LocalCampaignOverview {
    val (promo, rest) = messages.partition { it.match?.category == PROMO_CATEGORY }
    val (matched, unmatchedInput) = rest.partition { it.match != null }

    val aiCampaigns =
        matched
            .groupBy { it.match!!.id }
            .map { (clusterId, members) ->
                val match = members.first().match!!
                val category = match.category ?: OTHER_SCAM_CATEGORY
                LocalCampaign(
                    key = "ai:$clusterId",
                    title = match.label ?: category,
                    category = category,
                    reason = GroupReason.AI_MATCH,
                    clusterId = clusterId,
                    messages = members.sortedByDescending { it.timestamp },
                )
            }
    val (localGroups, unmatched) = groupUnmatched(unmatchedInput)
    val sections =
        (aiCampaigns + localGroups)
            .groupBy { it.category }
            .map { (category, campaigns) ->
                CategorySection(category, campaigns.sortedByDescending { it.messages.size })
            }.sortedByDescending { it.messageCount }

    return LocalCampaignOverview(
        sections = sections,
        unmatched = unmatched.sortedByDescending { it.timestamp },
        hiddenPromoCount = promo.size,
    )
}

private fun groupUnmatched(messages: List<LocalScamMessage>): Pair<List<LocalCampaign>, List<LocalScamMessage>> {
    val groups = mutableListOf<LocalCampaign>()
    val remaining = messages.toMutableList()

    // Pass 1: a shared link domain is the strongest local evidence of one blast.
    val byDomain = linkedMapOf<String, MutableList<LocalScamMessage>>()
    remaining.forEach { message ->
        linkDomains(message.body).firstOrNull()?.let { byDomain.getOrPut(it) { mutableListOf() }.add(message) }
    }
    byDomain.forEach { (domain, members) ->
        if (members.size >= MIN_LOCAL_GROUP_SIZE) {
            groups +=
                localGroup(
                    key = "link:$domain",
                    // Defanged ("lbc-track[.]xyz") so the name can't read as a tappable link.
                    title = "Same link: ${domain.replace(".", "[.]")}",
                    reason = GroupReason.SAME_LINK,
                    members = members,
                )
            remaining.removeAll(members.toSet())
        }
    }

    // Pass 2: similar wording, single-link clustering over TF-IDF cosine.
    val vectors = tfIdf(remaining.map { wordTokens(it.body) })
    val parent = IntArray(remaining.size) { it }

    fun root(i: Int): Int {
        var r = i
        while (parent[r] != r) r = parent[r]
        return r
    }
    for (i in remaining.indices) {
        for (j in i + 1 until remaining.size) {
            if (cosine(vectors[i], vectors[j]) >= SIMILAR_WORDING_THRESHOLD) parent[root(j)] = root(i)
        }
    }
    val clusters = remaining.indices.groupBy { root(it) }.values
    val leftovers = mutableListOf<LocalScamMessage>()
    clusters.forEach { indices ->
        val members = indices.map { remaining[it] }
        if (members.size >= MIN_LOCAL_GROUP_SIZE) {
            val category = inferCategory(members)
            groups +=
                localGroup(
                    key = "similar:${members.minOf { it.id }}",
                    title = "Similar ${category.lowercase()} messages",
                    reason = GroupReason.SIMILAR_WORDING,
                    members = members,
                    category = category,
                )
        } else {
            leftovers += members
        }
    }
    return groups.sortedByDescending { it.messages.size } to leftovers
}

private fun localGroup(
    key: String,
    title: String,
    reason: GroupReason,
    members: List<LocalScamMessage>,
    category: String = inferCategory(members),
) = LocalCampaign(
    key = key,
    title = title,
    category = category,
    reason = reason,
    clusterId = null,
    messages = members.sortedByDescending { it.timestamp },
)

/**
 * Same keyword vote as the AI side's campaign_naming.message_category, so a
 * group formed on the phone lands in the same category names the AI uses.
 * Keep the vocabularies in sync with ai/service/campaign_naming.py.
 */
internal fun inferCategory(members: List<LocalScamMessage>): String {
    val votes = members.mapNotNull { messageCategory(it.body) }.groupingBy { it }.eachCount()
    val (best, count) = votes.maxByOrNull { it.value } ?: return OTHER_SCAM_CATEGORY
    return if (count >= members.size * MIN_CATEGORY_SHARE) best else OTHER_SCAM_CATEGORY
}

internal fun messageCategory(text: String): String? {
    val low = text.lowercase()
    var best: String? = null
    var bestHits = 0
    SCAM_CATEGORIES.forEach { (category, keywords) ->
        val hits = keywords.count { wholeWord(it).containsMatchIn(low) }
        if (hits > bestHits) {
            best = category
            bestHits = hits
        }
    }
    return best
}

private const val MIN_CATEGORY_SHARE = 0.4

private val patterns = mutableMapOf<String, Regex>()

private const val NO_ALNUM_BEFORE = "(?<![a-z0-9])"
private const val NO_ALNUM_AFTER = "(?![a-z0-9])"

private fun wholeWord(kw: String) = patterns.getOrPut(kw) { Regex(NO_ALNUM_BEFORE + Regex.escape(kw) + NO_ALNUM_AFTER) }

private val SCAM_CATEGORIES: List<Pair<String, List<String>>> =
    listOf(
        "Parcel / delivery scam" to
            words(
                "parcel|delivery|redelivery|lbc|j&t|jnt|ninja van|shipment|package|courier|" +
                    "recipient|address",
            ),
        "Bank phishing" to
            words(
                "bdo|bpi|metrobank|unionbank|landbank|security bank|rcbc|pnb|chinabank|" +
                    "unauthorized|transaction|mybdo",
            ),
        "E-wallet phishing" to words("gcash|maya|paymaya|deactivation|deactivated|disabled|temporarily|advisory"),
        "Loan / credit offer" to
            words(
                "loan|collateral|credit card|approval|lending|utang|pautang|need cash|easy cash|" +
                    "credit|processing|getcash",
            ),
        "Online gambling / casino" to
            words(
                "bonus|deposit|deposito|magdeposito|jackpot|slot|casino|bet|roulette|bingo|jili|" +
                    "sabong|cashback|turnover|laro|maglaro|games|game|gojackpot|manalo|panalo|bets|" +
                    "cash out|play|wins",
            ),
        "Rewards / prize claim" to
            words(
                "points|redeem|expire|reward|rewards|prize|raffle|congratulations|won|premyo|" +
                    "red envelope|lucky|gift",
            ),
        "Job / task offer" to
            words(
                "trabaho|job|hiring|salary|sahod|kumita|earn|commission|task|part-time|part time|" +
                    "work from home|natutulog|habang|share|earn money",
            ),
        "OTP / account update" to words("otp|pin|update|updated|registered|sim|verify|verification"),
        "Government / ID request" to
            words(
                "government|requirements|dswd|sss|philhealth|bir|lto|nbi|ayuda|pagibig|pag-ibig|" +
                    "frontface|front face|valid id|selfie|kindly",
            ),
    )

private fun words(joined: String): List<String> = joined.split("|")

private val LINK =
    Regex("(https?://|www\\.)?([a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.([a-z]{2,}))(?:[/?#]\\S*)?", RegexOption.IGNORE_CASE)

// Scam links are often written bare ("gcash-verify.xyz"), but a bare match
// would also catch run-on sentences ("account.Click"), so without a scheme or
// www a domain only counts when its TLD is one links actually use.
private val BARE_LINK_TLDS =
    (
        "com net org ph info xyz top site online club vip cc me io link live shop app co bet win fun icu " +
            "store tk ml ga cf gq pw buzz asia biz"
    ).split(" ").toSet()

internal fun linkDomains(body: String): List<String> =
    LINK
        .findAll(body)
        .map { it.destructured }
        .filter { (scheme, _, tld) -> scheme.isNotEmpty() || tld.lowercase() in BARE_LINK_TLDS }
        .map { (_, domain, _) -> domain.lowercase().removePrefix("www.") }
        .distinct()
        .toList()

private val WORD = Regex("[\\p{L}\\p{N}]{3,}")

// The same English + Tagalog/Taglish filler the thread summarizer ignores,
// plus generic SMS words every scam shares, so similarity rests on content.
private val STOP_WORDS =
    (
        "the and are for from has have you your our this that with will was were can may just now all any please " +
            "not http https www com click link here text reply stop ang mga ito iyan iyon yan yun dito doon para " +
            "kung kapag pag dahil upang pero ngunit kaya yung iyong lahat bawat mula hanggang tungkol naman kasi " +
            "sana lang lamang din rin niya nila namin ninyo natin atin inyo kanila ako ikaw tayo kami kayo sila " +
            "may mayroon meron wala hindi"
    ).split(" ").toSet()

private fun wordTokens(body: String): List<String> =
    WORD
        .findAll(body.lowercase().replace(LINK, " "))
        .map { it.value }
        .filterNot { it in STOP_WORDS }
        .toList()

private fun tfIdf(docs: List<List<String>>): List<Map<String, Double>> {
    val documentFrequency = mutableMapOf<String, Int>()
    docs.forEach { tokens -> tokens.toSet().forEach { documentFrequency[it] = (documentFrequency[it] ?: 0) + 1 } }
    val n = docs.size.toDouble()
    return docs.map { tokens ->
        tokens.groupingBy { it }.eachCount().mapValues { (term, tf) ->
            tf * (ln((n + 1) / ((documentFrequency[term] ?: 0) + 1)) + 1)
        }
    }
}

private fun cosine(
    a: Map<String, Double>,
    b: Map<String, Double>,
): Double {
    if (a.isEmpty() || b.isEmpty()) return 0.0
    val dot = a.entries.sumOf { (term, weight) -> weight * (b[term] ?: 0.0) }
    val norm = sqrt(a.values.sumOf { it * it }) * sqrt(b.values.sumOf { it * it })
    return if (norm == 0.0) 0.0 else dot / norm
}
