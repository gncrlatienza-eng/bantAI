package com.bantai.data

import com.bantai.data.model.Classification
import com.bantai.util.SmsRiskSignals
import com.bantai.util.TransactionalMessage
import com.bantai.util.TrustedSenders

/** The on-device labelling rules: the offline heuristic, and read-time corrections to stored verdicts. */
object MessageClassifier {
    /**
     * The stored model verdict with two read-time corrections, which also fix
     * labels already on the phone: a receipt the model called Spam reads as
     * SAFE (TransactionalMessage), and a SCAM verdict on a built-in trusted
     * sender reads as UNKNOWN, since telcos/banks are never auto-blocked.
     * No stored verdict: the offline heuristic ([classify]).
     */
    fun resolve(
        stored: Classification?,
        body: String,
        sender: String,
    ): Classification {
        val label = stored?.let { TransactionalMessage.correct(it, body) } ?: return classify(body)
        return if (label == Classification.SCAM && TrustedSenders.isBuiltIn(sender)) Classification.UNKNOWN else label
    }

    /**
     * The offline heuristic, used only when no model verdict exists. It is a
     * keyword/pattern score, so it never claims more than it knows: at worst
     * UNKNOWN (never SCAM, which needs the backend model's confident verdict,
     * see docs/api/classify.md), at best UNVERIFIED (never SAFE, which means a
     * model actually checked it). The sender is ignored on purpose: SMS sender
     * names and numbers are trivially spoofed, so only the body counts.
     */
    fun classify(body: String): Classification {
        val suspicious = SmsRiskSignals.looksSuspicious(body)
        return if (suspicious) Classification.UNKNOWN else Classification.UNVERIFIED
    }
}
