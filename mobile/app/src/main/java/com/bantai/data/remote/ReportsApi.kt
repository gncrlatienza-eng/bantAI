package com.bantai.data.remote

import org.json.JSONObject

/**
 * Submits a user's FP/FN correction on a classified message (POST /api/reports,
 * JWT-guarded). The backend only accepts a messageId plus a corrected label —
 * there is no free-text field; `TakeActionScreen`'s "Additional notes" has
 * nowhere to go until the backend adds one.
 */
object ReportsApi {
    suspend fun submit(
        token: String,
        messageId: String,
        reportedLabel: String,
    ): Result<Unit> =
        HttpClient
            .post(
                "/reports",
                JSONObject().put("messageId", messageId).put("reportedLabel", reportedLabel),
                token,
            ).map { }
}
