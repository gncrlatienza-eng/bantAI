package com.bantai.data.remote

import org.json.JSONArray
import org.json.JSONObject

/**
 * Safety tips the BantAI team writes and publishes from the admin dashboard
 * (Admin -> Tips). Public endpoint: no sign-in needed, so a signed-out phone
 * still gets the latest warnings.
 */
object TipsApi {
    data class PublishedTip(
        val id: String,
        val title: String,
        val body: String,
        /** Free text set by the admin: a campaign category, name or id. Null = a general tip. */
        val campaign: String?,
        val updatedAt: String,
    )

    /** GET /tips -- published tips, newest first. */
    suspend fun listPublished(): Result<List<PublishedTip>> {
        val response = HttpClient.get("/tips", token = null)
        return response.mapCatching { body -> parseTips(JSONArray(body)) }
    }

    private fun parseTips(json: JSONArray): List<PublishedTip> {
        val tips = List(json.length()) { i -> parseTip(json.getJSONObject(i)) }
        return tips.filter { it.title.isNotBlank() }
    }

    private fun parseTip(json: JSONObject): PublishedTip =
        PublishedTip(
            id = json.optString("id"),
            title = json.optString("title").trim(),
            body = json.optString("body").trim(),
            campaign = json.optString("campaign").trim().takeIf { it.isNotEmpty() && it != "null" },
            updatedAt = json.optString("updatedAt"),
        )
}
