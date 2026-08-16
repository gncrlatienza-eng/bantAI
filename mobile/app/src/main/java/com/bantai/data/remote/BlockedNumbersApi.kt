package com.bantai.data.remote

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Syncs the local BlockedNumberContract list with the backend's BlockedNumber
 * table (WBS 4.3.12). The backend already auto-populates this table when
 * /sms/ingest auto-blocks a sender — this client covers the two directions
 * that don't already happen server-side: reading it back, and reflecting a
 * manual unblock.
 */
object BlockedNumbersApi {
    data class BlockedNumberEntry(
        val sender: String,
        val source: String,
        val createdAt: String,
    )

    class ApiException(
        message: String,
    ) : Exception(message)

    /** GET /blocked-numbers — every sender the backend has on record for this user. */
    suspend fun list(token: String): Result<List<BlockedNumberEntry>> = get("/blocked-numbers", token).mapCatching { body -> parseList(JSONArray(body)) }

    /** POST /blocked-numbers — idempotent; safe to call for a number already blocked. */
    suspend fun block(
        token: String,
        sender: String,
    ): Result<Unit> =
        withContext(Dispatchers.IO) {
            runCatching {
                post("/blocked-numbers", JSONObject().put("sender", sender), token)
                Unit
            }
        }

    /** DELETE /blocked-numbers/:sender — a 404 (already gone) is not surfaced as failure. */
    suspend fun unblock(
        token: String,
        sender: String,
    ): Result<Unit> =
        withContext(Dispatchers.IO) {
            runCatching {
                delete("/blocked-numbers/${java.net.URLEncoder.encode(sender, "UTF-8")}", token)
                Unit
            }
        }

    private fun parseList(json: JSONArray): List<BlockedNumberEntry> =
        List(json.length()) { i ->
            val entry = json.getJSONObject(i)
            BlockedNumberEntry(
                sender = entry.optString("sender"),
                source = entry.optString("source"),
                createdAt = entry.optString("createdAt"),
            )
        }

    private suspend fun get(
        path: String,
        token: String,
    ): Result<String> =
        withContext(Dispatchers.IO) {
            runCatching {
                val connection = URL(ApiConfig.BASE_URL + path).openConnection() as HttpURLConnection
                try {
                    connection.requestMethod = "GET"
                    connection.setRequestProperty("Authorization", "Bearer $token")
                    connection.connectTimeout = ApiConfig.DEFAULT_TIMEOUT_MS
                    connection.readTimeout = ApiConfig.DEFAULT_TIMEOUT_MS

                    val status = connection.responseCode
                    val text =
                        (if (status in 200..299) connection.inputStream else connection.errorStream)
                            ?.bufferedReader()
                            ?.use { it.readText() }
                            .orEmpty()
                    if (status !in 200..299) throw ApiException(parseErrorMessage(text, status))
                    text
                } finally {
                    connection.disconnect()
                }
            }
        }

    private fun post(
        path: String,
        body: JSONObject,
        token: String,
    ) {
        val connection = URL(ApiConfig.BASE_URL + path).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.connectTimeout = ApiConfig.DEFAULT_TIMEOUT_MS
            connection.readTimeout = ApiConfig.DEFAULT_TIMEOUT_MS
            connection.doOutput = true
            connection.outputStream.use { it.write(body.toString().toByteArray()) }

            val status = connection.responseCode
            val text =
                (if (status in 200..299) connection.inputStream else connection.errorStream)
                    ?.bufferedReader()
                    ?.use { it.readText() }
                    .orEmpty()
            if (status !in 200..299) throw ApiException(parseErrorMessage(text, status))
        } finally {
            connection.disconnect()
        }
    }

    private fun delete(
        path: String,
        token: String,
    ) {
        val connection = URL(ApiConfig.BASE_URL + path).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "DELETE"
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.connectTimeout = ApiConfig.DEFAULT_TIMEOUT_MS
            connection.readTimeout = ApiConfig.DEFAULT_TIMEOUT_MS

            val status = connection.responseCode
            // A 404 means the row is already gone — that's the caller's desired
            // end state, not a failure, so it's swallowed here rather than thrown.
            if (status !in 200..299 && status != 404) {
                val text =
                    connection.errorStream
                        ?.bufferedReader()
                        ?.use { it.readText() }
                        .orEmpty()
                throw ApiException(parseErrorMessage(text, status))
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun parseErrorMessage(
        body: String,
        status: Int,
    ): String =
        try {
            when (val message = JSONObject(body).get("message")) {
                is JSONArray -> (0 until message.length()).joinToString(", ") { message.getString(it) }
                else -> message.toString()
            }
        } catch (_: Exception) {
            "Request failed (HTTP $status)"
        }
}
