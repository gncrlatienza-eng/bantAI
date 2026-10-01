package com.bantai.data.remote

import org.json.JSONObject
import java.net.URLEncoder

/** Sender familiarity/risk lookup for the conversation header, plus community fraud reports. */
object VerificationApi {
    /**
     * POST /verification/sender/report -- attributable evidence only. A sender
     * becomes confirmed fraud for every user only after several independent
     * users report it and staff validate one of their Scam reports.
     */
    suspend fun reportSender(
        token: String,
        sender: String,
    ): Result<Unit> = HttpClient.post("/verification/sender/report", JSONObject().put("sender", sender), token).map { }

    data class SenderVerification(
        val familiarity: String,
        val risk: String,
        val organizationName: String? = null,
    )

    suspend fun verifySender(
        token: String,
        sender: String,
    ): Result<SenderVerification> =
        HttpClient
            .get("/verification/sender/${URLEncoder.encode(sender, "UTF-8")}", token)
            .mapCatching { parse(JSONObject(it)) }

    private fun parse(json: JSONObject): SenderVerification {
        val organization = json.optJSONObject("organization")
        return SenderVerification(
            familiarity = json.optString("familiarity", "unknown"),
            risk = json.optString("risk", "unknown"),
            organizationName = organization?.optString("name")?.takeIf { it.isNotEmpty() },
        )
    }
}
