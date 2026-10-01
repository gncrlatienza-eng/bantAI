package com.bantai.util

import com.bantai.data.model.Classification

/**
 * Recognises receipts, confirmations and one-time codes, so they are never
 * filed as spam.
 *
 * The deployed model (Model C) labels messages like "You paid P145.00 via
 * GCash for your ..." or "You have successfully subscribed to DITO LEVEL-UP 99"
 * as Spam at ~100% confidence: it has learned that brand/promo names mean
 * marketing, even when the message is a record of something the user did.
 * Those belong in Messages. This only ever downgrades a Spam label -- a Scam
 * verdict is never touched, so phishing that imitates a receipt still alerts.
 *
 * Deliberately conservative: a message must carry a clear transactional
 * signal, no sales call-to-action, and no link off an official domain.
 * Anything unsure stays in Spam. The link rule matters because SAFE shows
 * links clickable (SmsLinkSafety): "You have received P5,000.00. Ref no.
 * 88213. Verify to withdraw: http://gcash-claim.top" reads as a receipt but is
 * a phishing lure, and the model may call it Spam rather than Scam.
 */
object TransactionalMessage {
    private val SIGNALS =
        listOf(
            // Payments and transfers the user made or received.
            "\\byou(?:'ve| have)? (?:paid|sent|received|transferred)\\b",
            "\\b(?:payment|transfer|cash[- ]?in|cash[- ]?out|top[- ]?up|reload)\\b[^.!?]{0,40}" +
                "\\b(?:successful|received|completed|confirmed|posted)\\b",
            "\\bhas been (?:credited|debited|deducted|received|posted|refunded)\\b",
            // Confirmations of an action the user took.
            "\\byou(?:'ve| have)? successfully\\b",
            "\\bsuccessfully (?:subscribed|registered|purchased|paid|loaded|topped up|activated|renewed|" +
                "redeemed|claimed|linked)\\b",
            // (?:[^.!?]|\.\d) lets "0.99 points" through without crossing a sentence end.
            "\\byou(?:'ve| have) earned\\b(?:[^.!?]|\\.\\d){0,40}\\bpoints?\\b",
            "\\b(?:receipt|invoice|order (?:no|number|#))\\b",
            "\\bref(?:erence)?\\.?\\s*(?:no|number|#)\\b",
            // Codes and account state.
            "\\b(?:otp|one[- ]time (?:pin|password|code)|verification code|authentication code|security code)\\b",
            "\\byour (?:current |remaining |available )?(?:load |account |wallet )?balance (?:is|as of)\\b",
        ).map { Regex(it, RegexOption.IGNORE_CASE) }

    private val SALES_PITCH =
        Regex(
            "\\b(?:register now|avail now|shop now|buy now|claim now|order now|subscribe now|sign up now|" +
                "limited[- ]time|don't miss|hurry|click here|tap here|download the app|use code|promo code)\\b",
            RegexOption.IGNORE_CASE,
        )

    fun isTransactional(body: String): Boolean {
        val hasSignal = SIGNALS.any { it.containsMatchIn(body) }
        return hasSignal && !SALES_PITCH.containsMatchIn(body) && !SmsRiskSignals.hasUnofficialLink(body)
    }

    /** A stored "spam" label that is really a receipt/confirmation reads as "safe"; every other label is unchanged. */
    fun correct(
        classification: Classification,
        body: String,
    ): Classification =
        if (classification == Classification.SPAM && isTransactional(body)) {
            Classification.SAFE
        } else {
            classification
        }
}
