package com.bantai.util

import androidx.annotation.StringRes
import com.bantai.R

/**
 * One plain-language line under each "Why it was flagged" tag, so the list
 * teaches what to look for instead of showing a bare label. Keys are the tags
 * ai/service/indicator_tags.py emits; a tag not listed here (e.g. a new one
 * added on the AI side) simply shows without a line.
 */
object IndicatorExplanations {
    private val byTag: Map<String, Int> =
        mapOf(
            "Suspicious URL" to R.string.indicator_suspicious_url,
            "Brand Impersonation" to R.string.indicator_brand_impersonation,
            "Prize Lure" to R.string.indicator_prize_lure,
            "Urgency Cue" to R.string.indicator_urgency_cue,
            "Gambling Bait" to R.string.indicator_gambling_bait,
            "Fake Job Offer" to R.string.indicator_fake_job_offer,
            "Unsolicited Credit Offer" to R.string.indicator_unsolicited_credit,
            "Personal Info Request" to R.string.indicator_personal_info,
            "OTP / Account Phishing" to R.string.indicator_otp_phishing,
        )

    @StringRes
    fun forTag(tag: String): Int? = byTag[tag]
}
