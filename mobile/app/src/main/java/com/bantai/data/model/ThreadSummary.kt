package com.bantai.data.model

import kotlin.math.ln
import kotlin.math.sqrt

private const val DEFAULT_THREAD_SUMMARY_SENTENCES = 3
private const val DEFAULT_THREAD_SUMMARY_CHARACTERS = 400

// Fragments ("ok po", a permit number) compete for a slot without saying anything.
private const val MIN_MEANINGFUL_TOKENS = 3

// Jaccard overlap at which two sentences are the same template with a
// different time/amount (NDRRMC's repeated Taal advisories).
private const val DUPLICATE_OVERLAP = 0.8

// How strongly a candidate is penalised for repeating an already-picked sentence.
private const val REDUNDANCY_PENALTY = 1.0
private const val MIN_MARGINAL_SCORE = 0.05

// Older sentences keep 70% of their weight; the newest keep all of it.
private const val RECENCY_FLOOR = 0.7

private val HEADER = Regex("^\\s*[A-Za-z][A-Za-z0-9 .&-]{1,20}\\s*\\([^)]{0,40}\\)\\s*")
private val SENTENCE_BREAK = Regex("(?<=[.!?])\\s+|\\n+")
private val TOKEN = Regex("[\\p{L}]{2,}")

// Footers repeated on every promo -- central by frequency, but never the point.
private val BOILERPLATE =
    listOf(
        "per dti",
        "fair trade permit",
        "stop receiving",
        "unsubscribe",
        "opt out",
        "opt-out",
        "t&c",
        "terms and conditions",
        "text stop",
        "to stop",
    )

private class Candidate(
    var text: String,
    val tokens: Set<String>,
    var support: Int,
    var position: Int,
)

/**
 * Extractive summary of a thread, computed on-device: every sentence returned
 * was actually sent (the backend's POST /ai/summarize is disabled in
 * privacy-first mode, and generated wording could invent an amount or
 * deadline).
 *
 * Picks the sentences most *representative* of the thread rather than the most
 * unusual: near-duplicates are merged and counted, each sentence is scored by
 * its similarity to the rest of the thread weighted by those counts and by
 * recency, and later picks are penalised for overlapping earlier ones. The
 * previous rarity-based scoring picked "Lahat ay pinag-iingat." three times for
 * NDRRMC, because a thread's repeated main point has the lowest rarity of all.
 *
 * @param messagesOldestFirst thread messages in chronological order.
 * @return null when there are fewer than two distinct sentences to choose between.
 */
@Suppress("LoopWithTooManyJumpStatements") // skip-and-stop rules read clearest as continue/break
fun summarizeThread(
    messagesOldestFirst: List<SmsMessage>,
    maxSentences: Int = DEFAULT_THREAD_SUMMARY_SENTENCES,
    maxChars: Int = DEFAULT_THREAD_SUMMARY_CHARACTERS,
): String? {
    val candidates = mergedCandidates(messagesOldestFirst)
    if (candidates.size < 2) return null

    val vectors = tfIdfVectors(candidates)
    val norms = vectors.map { v -> sqrt(v.values.sumOf { it * it }).takeIf { it > 0 } ?: 1.0 }
    val n = candidates.size
    val similarity =
        Array(n) { a ->
            DoubleArray(n) { b ->
                if (a == b) {
                    0.0
                } else {
                    vectors[a].entries.sumOf { (w, x) -> x * (vectors[b][w] ?: 0.0) } / (norms[a] * norms[b])
                }
            }
        }

    val newest = candidates.maxOf { it.position }.coerceAtLeast(1)
    val rawScores =
        candidates.mapIndexed { a, candidate ->
            val centrality =
                (0 until n).sumOf { b -> similarity[a][b] * candidates[b].support } + ln(1.0 + candidate.support)
            centrality * (RECENCY_FLOOR + (1 - RECENCY_FLOOR) * candidate.position / newest)
        }
    val top = rawScores.max().takeIf { it > 0 } ?: 1.0
    val scores = rawScores.map { it / top }

    val chosen = mutableListOf<Int>()
    while (chosen.size < minOf(maxSentences, n)) {
        fun marginal(a: Int) = scores[a] - REDUNDANCY_PENALTY * (chosen.maxOfOrNull { similarity[a][it] } ?: 0.0)
        val best = (0 until n).filter { it !in chosen }.maxByOrNull(::marginal) ?: break
        if (chosen.isNotEmpty() && marginal(best) < MIN_MARGINAL_SCORE) break
        chosen += best
    }

    return chosen
        .sortedBy { candidates[it].position }
        .joinToString(" ") { candidates[it].text }
        .take(maxChars)
        .trim()
        .takeIf { it.isNotBlank() }
}

@Suppress("LoopWithTooManyJumpStatements") // skip-and-stop rules read clearest as continue/break
private fun mergedCandidates(messagesOldestFirst: List<SmsMessage>): List<Candidate> {
    val candidates = mutableListOf<Candidate>()
    var position = 0
    for (message in messagesOldestFirst) {
        for (sentence in splitSentences(message.body)) {
            position++
            val tokens = meaningfulTokens(sentence)
            if (tokens.size < MIN_MEANINGFUL_TOKENS) continue
            val lower = sentence.lowercase()
            if (BOILERPLATE.any { lower.contains(it) }) continue
            // A repeat keeps its newest wording and position, and counts as support.
            val duplicate = candidates.firstOrNull { jaccard(it.tokens, tokens) >= DUPLICATE_OVERLAP }
            if (duplicate != null) {
                duplicate.text = sentence
                duplicate.support++
                duplicate.position = position
            } else {
                candidates += Candidate(sentence, tokens, 1, position)
            }
        }
    }
    return candidates
}

private fun tfIdfVectors(candidates: List<Candidate>): List<Map<String, Double>> {
    val documentFrequency = mutableMapOf<String, Int>()
    candidates.forEach { c -> c.tokens.forEach { documentFrequency[it] = (documentFrequency[it] ?: 0) + 1 } }
    val n = candidates.size.toDouble()
    return candidates.map { c -> c.tokens.associateWith { ln((n + 1) / ((documentFrequency[it] ?: 0) + 1)) + 1 } }
}

private fun jaccard(
    a: Set<String>,
    b: Set<String>,
): Double {
    val union = (a + b).size
    return if (union == 0) 0.0 else (a intersect b).size.toDouble() / union
}

private fun splitSentences(body: String): List<String> =
    HEADER
        .replaceFirst(body.replace(Regex("[ \\t\\r]+"), " ").trim(), "")
        .split(SENTENCE_BREAK)
        .map(String::trim)
        .filter(String::isNotBlank)

private fun meaningfulTokens(text: String): Set<String> =
    TOKEN
        .findAll(text.lowercase())
        .map { it.value }
        .filterNot { it in SUMMARY_STOP_WORDS }
        .toSet()

// English plus Tagalog/Taglish function words, so "ang", "lahat", "dakong"-style
// filler can't outscore the words that carry a thread's content.
private val SUMMARY_STOP_WORDS =
    (
        "a an and are as at be but by for from has have in is it of on or that the this to was were will with " +
            "you your we our us i me my he she they them their its if not no so do can may just now all any please " +
            "ang ng sa na ay mga at ni kay nang pa din rin lang lamang po opo ito iyan iyon yan yun dito doon diyan " +
            "siya sila kami kayo niya nila namin ninyo natin atin ating inyo inyong kanila kanilang ko mo ka ako " +
            "ikaw tayo may mayroon meron wala hindi di oo para kung kapag pag dahil upang o pero ngunit kaya yung " +
            "iyong lahat bawat mula hanggang tungkol ba naman nga kasi pala raw daw sana dakong"
    ).split(" ").toSet()
