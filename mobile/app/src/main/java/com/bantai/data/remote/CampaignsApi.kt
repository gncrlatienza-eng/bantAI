package com.bantai.data.remote

import org.json.JSONArray
import org.json.JSONObject

/**
 * Reads campaign clusters from the backend (GET /api/campaigns, GET /api/campaigns/:id,
 * GET /api/campaigns/inactive).
 */
object CampaignsApi {
    data class CampaignSummary(
        val id: String,
        val label: String?,
        val urlDomains: List<String>,
        val isActive: Boolean,
        val messageCount: Int,
        val createdAt: String,
        val updatedAt: String,
    )

    data class CampaignMessagePreview(
        val id: String,
        val body: String,
        val receivedAt: String,
        val label: String?,
        val score: Double?,
        val bucket: String?,
    )

    data class CampaignDetail(
        val id: String,
        val label: String?,
        val urlDomains: List<String>,
        val isActive: Boolean,
        val messageCount: Int,
        val createdAt: String,
        val updatedAt: String,
        val messages: List<CampaignMessagePreview>,
    )

    suspend fun list(token: String): Result<List<CampaignSummary>> = HttpClient.get("/campaigns", token).mapCatching { body -> parseCampaignList(JSONArray(body)) }

    suspend fun listInactive(token: String): Result<List<CampaignSummary>> = HttpClient.get("/campaigns/inactive", token).mapCatching { body -> parseCampaignList(JSONArray(body)) }

    suspend fun getById(
        token: String,
        id: String,
    ): Result<CampaignDetail> =
        HttpClient
            .get("/campaigns/${java.net.URLEncoder.encode(id, "UTF-8")}", token)
            .mapCatching { body -> parseCampaignDetail(JSONObject(body)) }

    private fun parseCampaignList(json: JSONArray): List<CampaignSummary> = List(json.length()) { i -> parseCampaignSummary(json.getJSONObject(i)) }

    private fun parseCampaignSummary(json: JSONObject): CampaignSummary =
        CampaignSummary(
            id = json.getString("id"),
            label = json.optString("label").takeIf { it.isNotEmpty() },
            urlDomains = json.optJSONArray("urlDomains").toStringList(),
            isActive = json.optBoolean("isActive", true),
            messageCount = json.optInt("messageCount", 0),
            createdAt = json.optString("createdAt"),
            updatedAt = json.optString("updatedAt"),
        )

    private fun parseCampaignDetail(json: JSONObject): CampaignDetail {
        val messages = json.optJSONArray("messages")
        return CampaignDetail(
            id = json.getString("id"),
            label = json.optString("label").takeIf { it.isNotEmpty() },
            urlDomains = json.optJSONArray("urlDomains").toStringList(),
            isActive = json.optBoolean("isActive", true),
            messageCount = json.optInt("messageCount", 0),
            createdAt = json.optString("createdAt"),
            updatedAt = json.optString("updatedAt"),
            messages = List(messages?.length() ?: 0) { i -> parseMessagePreview(messages!!.getJSONObject(i)) },
        )
    }

    private fun parseMessagePreview(json: JSONObject): CampaignMessagePreview {
        val classification = json.optJSONObject("classification")
        return CampaignMessagePreview(
            id = json.getString("id"),
            body = json.optString("body"),
            receivedAt = json.optString("receivedAt"),
            label = classification?.optString("label")?.takeIf { it.isNotEmpty() },
            score = classification?.takeIf { it.has("score") }?.optDouble("score"),
            bucket = classification?.optString("bucket")?.takeIf { it.isNotEmpty() },
        )
    }

    private fun JSONArray?.toStringList(): List<String> = List(this?.length() ?: 0) { i -> this!!.getString(i) }
}
