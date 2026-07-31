package com.bantai.data.remote

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant

/**
 * Sends incoming SMS to the backend for classification by the fine-tuned model.
 *
 * The backend (POST /api/sms/ingest) stores the message, calls the Python ML
 * service, applies confidence-threshold routing, and returns the action the app
 * should take. Callers must treat any failure here as non-fatal and fall back to
 * the on-device heuristic in SmsRepository — see SmsReceiver.
 */
object SmsApi {

    /** Routing decision returned by the backend, mapped from its `action` field. */
    enum class Action { BLOCKED, ALERT, INBOX }

    data class IngestResult(
        val action: Action,
        val label: String,
        val score: Double,
        /** True when the sender was already on the block list and no work was done. */
        val suppressed: Boolean = false,
        val messageId: String? = null,
        val senderStatus: String? = null,
        val suppressedLinks: List<String> = emptyList(),
    )

    class ApiException(message: String) : Exception(message)

    /**
     * @param receivedAtMillis epoch millis from the SMS intent; converted to the
     *   ISO-8601 string the backend's `@IsDateString` validator requires.
     */
    suspend fun ingest(
        token: String,
        sender: String,
        body: String,
        receivedAtMillis: Long,
    ): Result<IngestResult> = withContext(Dispatchers.IO) {
        runCatching {
            val payload = JSONObject()
                .put("sender", sender)
                .put("body", body)
                .put("receivedAt", Instant.ofEpochMilli(receivedAtMillis).toString())

            parseIngestResponse(post("/sms/ingest", payload, token))
        }
    }

    private fun parseIngestResponse(raw: String): IngestResult {
        val json = JSONObject(raw)

        // Blocked senders short-circuit server-side: nothing is stored or classified.
        if (json.optBoolean("suppressed", false)) {
            return IngestResult(
                action = Action.BLOCKED,
                label = "Blocked",
                score = 1.0,
                suppressed = true,
            )
        }

        val classification = json.getJSONObject("classification")
        val links = json.optJSONArray("suppressedLinks")

        return IngestResult(
            action = toAction(json.getString("action")),
            label = classification.getString("label"),
            score = classification.getDouble("score"),
            messageId = json.optString("messageId").takeIf { it.isNotEmpty() },
            senderStatus = json.optString("senderStatus").takeIf { it.isNotEmpty() },
            suppressedLinks = List(links?.length() ?: 0) { links!!.getString(it) },
        )
    }

    // An unrecognised action must never silently hide a message, so anything
    // unexpected routes to the inbox.
    private fun toAction(value: String): Action = when (value) {
        "blocked" -> Action.BLOCKED
        "alert" -> Action.ALERT
        else -> Action.INBOX
    }

    private fun post(path: String, body: JSONObject, token: String): String {
        val connection = URL(ApiConfig.BASE_URL + path).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.connectTimeout = ApiConfig.SMS_TIMEOUT_MS
            connection.readTimeout = ApiConfig.SMS_TIMEOUT_MS
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
