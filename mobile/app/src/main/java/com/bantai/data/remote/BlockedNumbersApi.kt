package com.bantai.data.remote

import org.json.JSONArray
import org.json.JSONObject

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

    /** GET /blocked-numbers — every sender the backend has on record for this user. */
    suspend fun list(token: String): Result<List<BlockedNumberEntry>> = HttpClient.get("/blocked-numbers", token).mapCatching { body -> parseList(JSONArray(body)) }

    /** POST /blocked-numbers — idempotent; safe to call for a number already blocked. */
    suspend fun block(
        token: String,
        sender: String,
    ): Result<Unit> = HttpClient.post("/blocked-numbers", JSONObject().put("sender", sender), token).map { }

    /** DELETE /blocked-numbers/:sender — a 404 (already gone) is not surfaced as failure. */
    suspend fun unblock(
        token: String,
        sender: String,
    ): Result<Unit> =
        HttpClient.delete(
            "/blocked-numbers/${java.net.URLEncoder.encode(sender, "UTF-8")}",
            token,
            treat404AsSuccess = true,
        )

    private fun parseList(json: JSONArray): List<BlockedNumberEntry> =
        List(json.length()) { i ->
            val entry = json.getJSONObject(i)
            BlockedNumberEntry(
                sender = entry.optString("sender"),
                source = entry.optString("source"),
                createdAt = entry.optString("createdAt"),
            )
        }
}
