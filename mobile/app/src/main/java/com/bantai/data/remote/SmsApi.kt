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

    data class AlertSummary(
        val id: String,
        val status: String,
        val createdAt: String,
        val messageId: String,
        val sender: String,
        val body: String,
        val receivedAt: String,
        val label: String?,
        val score: Double?,
        val bucket: String?,
    )

    data class IndicatorTag(val tag: String, val weight: Double)

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

    /** GET /sms/alerts — all alerts for the signed-in user, newest first. */
    suspend fun getAlerts(token: String): Result<List<AlertSummary>> =
        get("/sms/alerts", token).mapCatching { body -> parseAlerts(JSONArray(body)) }

    /**
     * GET /sms/:messageId/indicators — SHAP-derived tags for one message.
     * An empty list is valid (SHAP may still be computing), not an error.
     */
    suspend fun getIndicators(token: String, messageId: String): Result<List<IndicatorTag>> =
        get("/sms/${java.net.URLEncoder.encode(messageId, "UTF-8")}/indicators", token)
            .mapCatching { body -> parseIndicators(JSONObject(body)) }

    private fun parseAlerts(json: JSONArray): List<AlertSummary> =
        List(json.length()) { i -> parseAlert(json.getJSONObject(i)) }

    private fun parseAlert(json: JSONObject): AlertSummary {
        val message = json.getJSONObject("message")
        val classification = message.optJSONObject("classification")
        return AlertSummary(
            id = json.getString("id"),
            status = json.optString("status"),
            createdAt = json.optString("createdAt"),
            messageId = message.getString("id"),
            sender = message.optString("sender"),
            body = message.optString("body"),
            receivedAt = message.optString("receivedAt"),
            label = classification?.optString("label")?.takeIf { it.isNotEmpty() },
            score = classification?.takeIf { it.has("score") }?.optDouble("score"),
            bucket = classification?.optString("bucket")?.takeIf { it.isNotEmpty() },
        )
    }

    private fun parseIndicators(json: JSONObject): List<IndicatorTag> {
        val indicators = json.optJSONArray("indicators") ?: return emptyList()
        return List(indicators.length()) { i ->
            val tag = indicators.getJSONObject(i)
            IndicatorTag(tag = tag.optString("tag"), weight = tag.optDouble("weight", 0.0))
        }
    }

    private suspend fun get(path: String, token: String): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            val connection = URL(ApiConfig.BASE_URL + path).openConnection() as HttpURLConnection
            try {
                connection.requestMethod = "GET"
                connection.setRequestProperty("Authorization", "Bearer $token")
                connection.connectTimeout = ApiConfig.DEFAULT_TIMEOUT_MS
                connection.readTimeout = ApiConfig.DEFAULT_TIMEOUT_MS

                val status = connection.responseCode
                val text = (if (status in 200..299) connection.inputStream else connection.errorStream)
                    ?.bufferedReader()?.use { it.readText() }
                    .orEmpty()
                if (status !in 200..299) throw ApiException(parseErrorMessage(text, status))
                text
            } finally {
                connection.disconnect()
            }
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

    // ── Alert types ───────────────────────────────────────────────────────────

    data class AlertMessage(
        val id: String,
        val sender: String,
        val body: String,
        val receivedAt: String,
        val label: String?,
        val score: Double?,
        val bucket: String?,
    )

    data class AlertItem(
        val id: String,
        val status: String,
        val createdAt: String,
        val message: AlertMessage,
    )

    data class Indicator(
        val tag: String,
        val weight: Double,
    )

    suspend fun getAlerts(token: String): Result<List<AlertItem>> =
        get("/sms/alerts", token).mapCatching { body ->
            val arr = JSONArray(body)
            List(arr.length()) { i -> parseAlertItem(arr.getJSONObject(i)) }
        }

    suspend fun getIndicators(token: String, messageId: String): Result<List<Indicator>> =
        get("/sms/${java.net.URLEncoder.encode(messageId, "UTF-8")}/indicators", token)
            .mapCatching { body ->
                val arr = JSONObject(body).getJSONArray("indicators")
                List(arr.length()) { i ->
                    val obj = arr.getJSONObject(i)
                    Indicator(tag = obj.getString("tag"), weight = obj.getDouble("weight"))
                }
            }

    private fun parseAlertItem(json: JSONObject): AlertItem {
        val msg = json.getJSONObject("message")
        val cls = msg.optJSONObject("classification")
        return AlertItem(
            id = json.getString("id"),
            status = json.getString("status"),
            createdAt = json.getString("createdAt"),
            message = AlertMessage(
                id = msg.getString("id"),
                sender = msg.getString("sender"),
                body = msg.getString("body"),
                receivedAt = msg.getString("receivedAt"),
                label = cls?.optString("label")?.takeIf { it.isNotEmpty() },
                score = cls?.takeIf { it.has("score") }?.optDouble("score"),
                bucket = cls?.optString("bucket")?.takeIf { it.isNotEmpty() },
            ),
        )
    }

    private suspend fun get(path: String, token: String): Result<String> =
        withContext(Dispatchers.IO) {
            runCatching {
                val connection = URL(ApiConfig.BASE_URL + path).openConnection() as HttpURLConnection
                try {
                    connection.requestMethod = "GET"
                    connection.setRequestProperty("Authorization", "Bearer $token")
                    connection.connectTimeout = ApiConfig.DEFAULT_TIMEOUT_MS
                    connection.readTimeout = ApiConfig.DEFAULT_TIMEOUT_MS

                    val status = connection.responseCode
                    val text = (if (status in 200..299) connection.inputStream else connection.errorStream)
                        ?.bufferedReader()?.use { it.readText() }
                        .orEmpty()
                    if (status !in 200..299) throw ApiException(parseErrorMessage(text, status))
                    text
                } finally {
                    connection.disconnect()
                }
            }
        }
}
