package com.bantai.data.remote

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Proxies the AI service's extractive thread summarizer via the backend's
 * POST /api/ai/summarize (see docs/api/summarize.md). Backs the AI Message
 * Summary sheet (WBS 4.3.11) — mirrors SmsApi.kt's plain-HttpURLConnection
 * style rather than adding Retrofit.
 */
object SummarizeApi {

    data class SummarizeResult(
        val summary: String,
        val sentenceCount: Int,
        val sourceMessageCount: Int,
        val truncated: Boolean,
    )

    class ApiException(message: String) : Exception(message)

    /**
     * @param messages thread bodies, oldest first, non-empty.
     * @param maxSentences 1-10; omitted lets the backend default to 3.
     */
    suspend fun summarize(
        token: String,
        messages: List<String>,
        maxSentences: Int? = null,
        timeoutMs: Int = ApiConfig.SUMMARIZE_TIMEOUT_MS,
    ): Result<SummarizeResult> = withContext(Dispatchers.IO) {
        runCatching {
            val payload = JSONObject().put("messages", JSONArray(messages))
            if (maxSentences != null) payload.put("maxSentences", maxSentences)

            parseResponse(post("/ai/summarize", payload, token, timeoutMs))
        }
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

    private fun post(path: String, body: JSONObject, token: String, timeoutMs: Int): String {
        val connection = URL(ApiConfig.BASE_URL + path).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.connectTimeout = timeoutMs
            connection.readTimeout = timeoutMs
            connection.doOutput = true
            connection.outputStream.use { it.write(body.toString().toByteArray()) }

            val status = connection.responseCode
            val text = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader()?.use { it.readText() }
                .orEmpty()
            if (status !in 200..299) throw ApiException(parseErrorMessage(text, status))
            return text
        } finally {
            connection.disconnect()
        }
    }

    private fun parseErrorMessage(body: String, status: Int): String = try {
        when (val message = JSONObject(body).get("message")) {
            is JSONArray -> (0 until message.length()).joinToString(", ") { message.getString(it) }
            else -> message.toString()
        }
    } catch (_: Exception) {
        "Request failed (HTTP $status)"
    }
}
