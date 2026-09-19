package com.bantai.data.remote

import org.json.JSONObject
import java.net.URLEncoder

/** Read-only sender familiarity/risk lookup for the conversation header. */
object VerificationApi {
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
