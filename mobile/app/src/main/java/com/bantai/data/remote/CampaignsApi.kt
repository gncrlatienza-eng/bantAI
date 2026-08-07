package com.bantai.data.remote

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Reads campaign clusters from the backend (GET /api/campaigns, GET /api/campaigns/:id).
 */
object CampaignsApi {

    private val BASE_URL get() = ApiConfig.BASE_URL

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
        val sender: String,
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

    class ApiException(message: String) : Exception(message)

    suspend fun list(token: String): Result<List<CampaignSummary>> =
        get("/campaigns", token).mapCatching { body -> parseCampaignList(JSONArray(body)) }

    suspend fun listInactive(token: String): Result<List<CampaignSummary>> =
        get("/campaigns/inactive", token).mapCatching { body -> parseCampaignList(JSONArray(body)) }

    suspend fun getById(token: String, id: String): Result<CampaignDetail> =
        get("/campaigns/${java.net.URLEncoder.encode(id, "UTF-8")}", token)
            .mapCatching { body -> parseCampaignDetail(JSONObject(body)) }

    private fun parseCampaignList(json: JSONArray): List<CampaignSummary> =
        List(json.length()) { i -> parseCampaignSummary(json.getJSONObject(i)) }

    private fun parseCampaignSummary(json: JSONObject): CampaignSummary = CampaignSummary(
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
            sender = json.optString("sender"),
            body = json.optString("body"),
            receivedAt = json.optString("receivedAt"),
            label = classification?.optString("label")?.takeIf { it.isNotEmpty() },
            score = classification?.takeIf { it.has("score") }?.optDouble("score"),
            bucket = classification?.optString("bucket")?.takeIf { it.isNotEmpty() },
        )
    }

    private fun JSONArray?.toStringList(): List<String> =
        List(this?.length() ?: 0) { i -> this!!.getString(i) }

    private suspend fun get(path: String, token: String): Result<String> =
        withContext(Dispatchers.IO) {
            runCatching {
                val connection = URL(BASE_URL + path).openConnection() as HttpURLConnection
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

    private fun parseErrorMessage(body: String, status: Int): String = try {
        when (val message = JSONObject(body).get("message")) {
            is JSONArray -> (0 until message.length()).joinToString(", ") { message.getString(it) }
            else -> message.toString()
        }
    } catch (_: Exception) {
        "Request failed (HTTP $status)"
    }
}
