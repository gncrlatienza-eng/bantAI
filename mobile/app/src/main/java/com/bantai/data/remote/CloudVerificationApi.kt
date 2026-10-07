package com.bantai.data.remote

import org.json.JSONObject

/** Status only: the cloud result never silently replaces the on-device verdict. */
object CloudVerificationApi {
    data class Status(
        val jobId: String,
        val state: String,
        val retryAfter: String?,
    ) {
        val pending: Boolean get() = state in setOf("pending", "processing", "retryable_failure")
        val retryable: Boolean get() = state in setOf("retryable_failure", "failed")
        val title: String get() =
            when (state) {
                "pending" -> "Cloud check queued"
                "processing" -> "Cloud check in progress"
                "verified" -> "Cloud check complete"
                "retryable_failure" -> "Cloud check waiting to retry"
                "failed" -> "Cloud check unavailable"
                else -> "Cloud status unavailable"
            }
        val description: String get() =
            when (state) {
                "pending" -> "Cloud verification is queued. Your on-device result stays available."
                "processing" -> "Cloud verification is running. The service may be warming up."
                "verified" -> "Cloud verification is complete. Your on-device result is shown separately."
                "retryable_failure" -> "Cloud verification will retry. Your on-device result is unchanged."
                "failed" -> "Cloud verification could not finish. You can retry."
                else -> "Cloud verification status is unavailable."
            }
    }

    suspend fun get(
        token: String,
        messageId: String,
    ): Result<Status> = HttpClient.get("/sms/${encodePathSegment(messageId)}/verification", token).mapCatching(::parse)

    suspend fun retry(
        token: String,
        messageId: String,
    ): Result<Status> =
        HttpClient
            .post(
                "/sms/${encodePathSegment(messageId)}/verification/retry",
                JSONObject(),
                token,
            ).mapCatching(::parse)

    private fun parse(body: String): Status {
        val status = JSONObject(body).getJSONObject("cloudVerification")
        return Status(status.getString("jobId"), status.getString("status"), status.optNullableString("retryAfter"))
    }
}
