package com.bantai.data.remote

import org.json.JSONArray
import org.json.JSONObject
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
        val clusterId: String?,
    )

    data class IndicatorTag(
        val tag: String,
        val weight: Double,
    )

    /**
     * @param receivedAtMillis epoch millis from the SMS intent; converted to the
     *   ISO-8601 string the backend's `@IsDateString` validator requires.
     */
    suspend fun ingest(
        token: String,
        sender: String,
        body: String,
        receivedAtMillis: Long,
        timeoutMs: Int = ApiConfig.SMS_TIMEOUT_MS,
    ): Result<IngestResult> {
        val payload =
            JSONObject()
                .put("sender", sender)
                .put("body", body)
                .put("receivedAt", Instant.ofEpochMilli(receivedAtMillis).toString())

        return HttpClient.post("/sms/ingest", payload, token, timeoutMs).mapCatching { parseIngestResponse(it) }
    }

    /** GET /sms/alerts — all alerts for the signed-in user, newest first. */
    suspend fun getAlerts(token: String): Result<List<AlertSummary>> = HttpClient.get("/sms/alerts", token).mapCatching { body -> parseAlerts(JSONArray(body)) }

    /**
     * GET /sms/:messageId/indicators — SHAP-derived tags for one message.
     * An empty list is valid (SHAP may still be computing), not an error.
     */
    suspend fun getIndicators(
        token: String,
        messageId: String,
    ): Result<List<IndicatorTag>> =
        HttpClient
            .get("/sms/${java.net.URLEncoder.encode(messageId, "UTF-8")}/indicators", token)
            .mapCatching { body -> parseIndicators(JSONObject(body)) }

    private fun parseAlerts(json: JSONArray): List<AlertSummary> = List(json.length()) { i -> parseAlert(json.getJSONObject(i)) }

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
            label = classification?.optNullableString("label"),
            score = classification?.takeIf { it.has("score") }?.optDouble("score"),
            bucket = classification?.optNullableString("bucket"),
            clusterId = message.optNullableString("clusterId"),
        )
    }

    // org.json's optString(name) turns a JSON `null` value into the literal 4-char
    // string "null" (JSONObject.NULL.toString()), not a real null — so a plain
    // isNotEmpty() check doesn't catch it. That literal string previously slipped
    // through as a real clusterId and crashed campaign navigation.
    private fun JSONObject.optNullableString(name: String): String? {
        val value = optString(name)
        return value.takeIf { it.isNotEmpty() && it != "null" }
    }

    private fun parseIndicators(json: JSONObject): List<IndicatorTag> {
        val indicators = json.optJSONArray("indicators") ?: return emptyList()
        return List(indicators.length()) { i ->
            val tag = indicators.getJSONObject(i)
            IndicatorTag(tag = tag.optString("tag"), weight = tag.optDouble("weight", 0.0))
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
    private fun toAction(value: String): Action =
        when (value) {
            "blocked" -> Action.BLOCKED
            "alert" -> Action.ALERT
            else -> Action.INBOX
        }
}
