package com.bantai.data.offline

import com.bantai.data.model.Classification

private const val MODEL_C_CLASS_COUNT = 3
private const val HAM_THRESHOLD = 0.50
private const val SPAM_THRESHOLD = 0.60
private const val SCAM_THRESHOLD = 0.90
private const val REVIEW_MARGIN = 0.15
private val MODEL_C_LABELS = listOf("Ham", "Spam", "Scam")
private val MODEL_C_THRESHOLDS = doubleArrayOf(HAM_THRESHOLD, SPAM_THRESHOLD, SCAM_THRESHOLD)

internal data class ModelCDecision(
    val modelLabel: String,
    val score: Double,
    val classification: Classification,
    val highRisk: Boolean,
    val requiresReview: Boolean,
)

/** Applies the same per-class thresholds and near-tie rule as ai/service/classifier.py. */
internal fun routeModelCProbabilities(probabilities: DoubleArray): ModelCDecision {
    require(probabilities.size == MODEL_C_CLASS_COUNT) { "Model C must return Ham, Spam, Scam probabilities" }
    require(probabilities.all { it.isFinite() && it in 0.0..1.0 }) { "Invalid Model C probabilities" }
    val order = probabilities.indices.sortedByDescending(probabilities::get)
    val winner = order[0]
    val score = probabilities[winner]
    val margin = score - probabilities[order[1]]
    val threshold = MODEL_C_THRESHOLDS[winner]
    val review = score < threshold || margin < REVIEW_MARGIN
    val classification =
        when {
            review -> Classification.UNKNOWN
            winner == 0 -> Classification.SAFE
            winner == 1 -> Classification.SPAM
            // A local verdict must not claim the sender was blocked. Surface a
            // high-priority review; cloud/device block state remains separate.
            else -> Classification.UNKNOWN
        }
    return ModelCDecision(
        modelLabel = MODEL_C_LABELS[winner],
        score = score,
        classification = classification,
        highRisk = winner == 2 && !review,
        requiresReview = review || winner == 2,
    )
}
