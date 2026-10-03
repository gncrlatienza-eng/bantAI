package com.bantai.data.remote

import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

/**
 * Sends locally masked text to the backend's deployed classifier. Raw SMS text
 * never leaves the handset. The sender is transmitted only so the backend can
 * derive a non-reversible server-side pseudonym (an HMAC); only that pseudonym
 * is stored, never the number or name itself.
 */
object SmsApi {
    /** Routing decision returned by the backend, mapped from its `action` field. */
    enum class Action { BLOCKED, ALERT, INBOX }

    data class IngestResult(
        val action: Action,
        val label: String,
        val score: Double,
        val classificationSource: String? = null,
        /** True when the sender was already on the block list and no work was done. */
        val suppressed: Boolean = false,
        val messageId: String? = null,
        val senderStatus: String? = null,
        val suppressedLinks: List<String> = emptyList(),
        /** The model's routing bucket (safe/unknown/spam/blocked); null from older backends. */
        val bucket: String? = null,
        /** The campaign the backend linked this message to; null when none (or an older backend). */
        val campaign: CampaignMatch? = null,
        /** False when the backend predates campaign linking, so "no campaign" can't be trusted. */
        val campaignKnown: Boolean = false,
    )

    data class CampaignMatch(
        val id: String,
        val label: String?,
        val category: String?,
    )

    data class AlertSummary(
        val id: String,
        val status: String,
        val createdAt: String,
        val messageId: String,
        val sourceId: String?,
        val sender: String,
        val body: String,
        val receivedAt: String,
        val label: String?,
        val score: Double?,
        val bucket: String?,
        val clusterId: String?,
        /**
         * Set on the phone, not by the backend: whether this alert's sender is
         * actually blocked (Android's block list or BantAI's own record, see
         * BlockHelper.isSenderBlocked). A scam verdict alone doesn't mean that.
         */
        val senderBlocked: Boolean = false,
        /** The user's own report on this message, if they filed one. */
        val report: AlertReport? = null,
        /**
         * Shared by messages the user selected and reported together (GET
         * /reports/mine), so Reported lists them as one entry. Null otherwise.
         */
        val groupId: String? = null,
        /** Set on the phone: this SMS's row on the device, to open its bubble. */
        val localId: Long? = null,
        /** Set on the phone: the saved contact name for [sender], if any. */
        val senderName: String? = null,
    )

    /**
     * A user's report on an alert: what they said it is (Scam/Spam/Ham) and
     * where BantAI's review of it stands (Pending, Validated, Rejected).
     */
    data class AlertReport(
        val reportedLabel: String,
        val status: String,
        // For the report page: when it was filed, the user's own note, and
        // once reviewed, when and the reviewer's reason. Null when not sent
        // (a report filed on this phone that the backend hasn't returned yet).
        val createdAt: String? = null,
        val note: String? = null,
        val adminNote: String? = null,
        val reviewedAt: String? = null,
    )

    data class IndicatorTag(
        val tag: String,
        val weight: Double,
    )

    /** Values required by the privacy-safe SMS ingestion endpoint. */
    data class IngestRequest(
        val sender: String,
        val receivedAtMillis: Long,
        val sourceId: String,
        val maskedBody: String,
        val label: String,
        val score: Double,
        val bucket: String,
        val domains: List<String>,
        val timeoutMs: Int = ApiConfig.SMS_TIMEOUT_MS,
    )

    /**
     * @param receivedAtMillis epoch millis from the SMS intent; converted to the
     *   ISO-8601 string the backend's `@IsDateString` validator requires.
     */
    suspend fun ingest(
        token: String,
        request: IngestRequest,
    ): Result<IngestResult> {
        val payload =
            JSONObject()
                .put("sender", request.sender)
                .put("maskedBody", request.maskedBody)
                .put("receivedAt", Instant.ofEpochMilli(request.receivedAtMillis).toString())
                .put("sourceId", request.sourceId)
                .put("label", request.label)
                .put("score", request.score)
                .put("bucket", request.bucket)
                .put("domains", JSONArray(request.domains))

        return HttpClient.post("/sms/ingest", payload, token, request.timeoutMs).mapCatching { parseIngestResponse(it) }
    }

    /** Server page size for GET /sms/alerts (ListAlertsQueryDto's maximum). */
    const val ALERTS_PAGE_SIZE = 100

    /**
     * GET /sms/alerts — the signed-in user's alerts, newest first. The backend
     * returns at most [ALERTS_PAGE_SIZE] per call; with [maxPages] > 1 this
     * follows the `before` (createdAt) cursor so older alerts are included too.
     */
    suspend fun getAlerts(
        token: String,
        maxPages: Int = 1,
    ): Result<List<AlertSummary>> =
        runCatching {
            val all = mutableListOf<AlertSummary>()
            var cursor: AlertSummary? = null
            repeat(maxPages.coerceAtLeast(1)) {
                val path =
                    cursor?.let {
                        // (createdAt, id) keyset: alerts sharing a millisecond
                        // are never skipped between pages.
                        "/sms/alerts?before=${encodePathSegment(it.createdAt)}" +
                            "&beforeId=${encodePathSegment(it.id)}&limit=$ALERTS_PAGE_SIZE"
                    } ?: "/sms/alerts"
                val page = parseAlerts(JSONArray(HttpClient.get(path, token).getOrThrow()))
                all += page
                val last = page.lastOrNull()?.takeIf { it.createdAt.isNotEmpty() }
                if (page.size < ALERTS_PAGE_SIZE || last == null) return@runCatching all
                cursor = last
            }
            all
        }

    /**
     * GET /sms/:messageId/alert — the one alert for this message (Alert detail),
     * instead of downloading the whole list to find it. A 404 (no alert, or not
     * this user's message) comes back as success(null).
     */
    suspend fun getAlertForMessage(
        token: String,
        messageId: String,
    ): Result<AlertSummary?> =
        HttpClient
            .get("/sms/${encodePathSegment(messageId)}/alert", token)
            .mapCatching { body -> parseAlert(JSONObject(body)) as AlertSummary? }
            .recoverCatching { error ->
                if ((error as? ApiException)?.status == HTTP_NOT_FOUND) null else throw error
            }

    private const val HTTP_NOT_FOUND = 404

    /**
     * GET /sms/:messageId/indicators -- returns the tags the classifier
     * (keyword tagger and/or SHAP, see `explanation_method` in `ai/service`)
     * recorded for this message at classify time, or an empty list if none
     * were recorded. These are computed server-side from the masked text the
     * backend already receives at ingest -- unrelated to, and not blocked by,
     * raw message bodies staying on-device. Called by
     * AlertDetailViewModel.load() to populate SmishingAlertScreen/
     * ThreatAnalysisScreen's "why it was flagged" section.
     */
    suspend fun getIndicators(
        token: String,
        messageId: String,
    ): Result<List<IndicatorTag>> =
        HttpClient
            .get("/sms/${encodePathSegment(messageId)}/indicators", token)
            .mapCatching { body -> parseIndicators(JSONObject(body)) }

    internal fun parseAlerts(json: JSONArray): List<AlertSummary> {
        val count = json.length()
        return List(count) { i -> parseAlert(json.getJSONObject(i)) }
    }

    private fun parseAlert(json: JSONObject): AlertSummary {
        val message = json.getJSONObject("message")
        val classification = message.optJSONObject("classification")
        return AlertSummary(
            id = json.getString("id"),
            status = json.optString("status"),
            createdAt = json.optString("createdAt"),
            messageId = message.getString("id"),
            // Never turn a privacy placeholder into an actionable sender.
            sender = "",
            body = "Message content remains in your device inbox.",
            receivedAt = message.optString("receivedAt"),
            sourceId = message.optString("sourceId").takeIf { it.isNotEmpty() },
            label = classification?.let { displayClassificationLabel(it.optString("label"), it.optString("bucket")) },
            score = classification?.takeIf { it.has("score") }?.optDouble("score"),
            bucket = classification?.optNullableString("bucket"),
            clusterId = message.optNullableString("clusterId"),
            report =
                message.optJSONArray("reports")?.optJSONObject(0)?.let {
                    val status = it.optString("status")
                    AlertReport(
                        reportedLabel = it.optString("reportedLabel"),
                        status = status,
                        createdAt = it.optNullableString("createdAt"),
                        note = it.optNullableString("note"),
                        adminNote = it.optNullableString("adminNote"),
                        // /reports/mine sends reviewedAt; the alerts list sends
                        // updatedAt, which is the review time once it's left Pending.
                        reviewedAt =
                            it.optNullableString("reviewedAt")
                                ?: it.optNullableString("updatedAt").takeIf { status != "Pending" },
                    )
                },
            groupId = json.optNullableString("groupId"),
        )
    }
    // optNullableString moved to JsonExtensions.kt -- CampaignsApi needed the
    // same null-vs-"null" fix (see that file's usage).

    private fun parseIndicators(json: JSONObject): List<IndicatorTag> {
        val indicators = json.optJSONArray("indicators") ?: return emptyList()
        return List(indicators.length()) { i ->
            val tag = indicators.getJSONObject(i)
            IndicatorTag(tag = tag.optString("tag"), weight = tag.optDouble("weight", 0.0))
        }
    }

    private fun parseIngestResponse(raw: String): IngestResult {
        val json = JSONObject(raw)

        // A sender already on this user's block list: the backend still stores
        // and classifies the message (sms.service.ts ingest) and returns its
        // messageId, so the user can still report it ("not a scam?"). Locally
        // it stays a silent block.
        if (json.optBoolean("suppressed", false)) {
            return IngestResult(
                action = Action.BLOCKED,
                label = "Blocked",
                score = 1.0,
                suppressed = true,
                messageId = json.optString("messageId").takeIf { it.isNotEmpty() },
                bucket = json.optJSONObject("classification")?.optNullableString("bucket"),
            )
        }

        val classification = json.getJSONObject("classification")
        val links = json.optJSONArray("suppressedLinks")

        return IngestResult(
            action = toAction(json.getString("action")),
            label = classification.getString("label"),
            score = classification.getDouble("score"),
            classificationSource = json.optString("classificationSource").takeIf { it.isNotEmpty() },
            messageId = json.optString("messageId").takeIf { it.isNotEmpty() },
            senderStatus = json.optString("senderStatus").takeIf { it.isNotEmpty() },
            suppressedLinks = List(links?.length() ?: 0) { links!!.getString(it) },
            bucket = classification.optNullableString("bucket"),
            campaign =
                json.optJSONObject("campaign")?.let { campaign ->
                    campaign.optNullableString("id")?.let { id ->
                        CampaignMatch(
                            id = id,
                            label = campaign.optNullableString("label"),
                            category = campaign.optNullableString("category"),
                        )
                    }
                },
            campaignKnown = json.has("campaign"),
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

    /**
     * The model's Ham/Spam/Scam taxonomy remains in the API and evaluation
     * artifacts. The participant-facing language follows the manuscript's
     * three alert terms without pretending that a low-confidence result is a
     * fraud verdict.
     */
    private fun displayClassificationLabel(
        label: String,
        bucket: String,
    ): String? =
        when {
            label == "Scam" -> "Likely Smishing"
            label == "Spam" -> "Suspicious"
            bucket == "unknown" -> "Unknown"
            label == "Ham" -> "Safe"
            else -> label.takeIf { it.isNotBlank() }
        }
}
