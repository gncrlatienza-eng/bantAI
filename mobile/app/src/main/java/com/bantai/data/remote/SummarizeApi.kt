package com.bantai.data.remote

import org.json.JSONArray
import org.json.JSONObject

/**
 * Proxies the AI service's extractive thread summarizer via the backend's
 * POST /api/ai/summarize (see docs/api/summarize.md). Backs the AI Message
 * Summary sheet (WBS 4.3.11).
 */
object SummarizeApi {
    data class SummarizeResult(
        val summary: String,
        val sentenceCount: Int,
        val sourceMessageCount: Int,
        val truncated: Boolean,
    )

    /**
     * @param messages thread bodies, oldest first, non-empty.
     * @param maxSentences 1-10; omitted lets the backend default to 3.
     */
    suspend fun summarize(
        token: String,
        messages: List<String>,
        maxSentences: Int? = null,
        timeoutMs: Int = ApiConfig.SUMMARIZE_TIMEOUT_MS,
    ): Result<SummarizeResult> {
        val payload = JSONObject().put("messages", JSONArray(messages))
        if (maxSentences != null) payload.put("maxSentences", maxSentences)

        return HttpClient.post("/ai/summarize", payload, token, timeoutMs).mapCatching { parseResponse(it) }
    }

    private fun parseResponse(raw: String): SummarizeResult {
        val json = JSONObject(raw)
        return SummarizeResult(
            summary = json.optString("summary"),
            sentenceCount = json.optInt("sentenceCount"),
            sourceMessageCount = json.optInt("sourceMessageCount"),
            truncated = json.optBoolean("truncated"),
        )
    }
}
