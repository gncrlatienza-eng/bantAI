package com.bantai.data.remote

import org.json.JSONArray
import org.json.JSONObject

/**
 * Syncs the local BlockedNumberContract list with the backend's BlockedNumber
 * table (WBS 4.3.12). Blocking is a user action; this client keeps that
 * user-selected list synchronized with the backend record.
 */
object BlockedNumbersApi {
    data class BlockedNumberEntry(
        val id: String,
        val source: String,
        val createdAt: String,
    )

    /** GET /blocked-numbers — every sender the backend has on record for this user. */
    suspend fun list(token: String): Result<List<BlockedNumberEntry>> = HttpClient.get("/blocked-numbers", token).mapCatching { body -> parseList(JSONArray(body)) }

    /**
     * POST /blocked-numbers — idempotent; safe to call for a number already blocked.
     * [automatic] marks the phone's own high-confidence scam blocks as `AutoBlock`
     * so the server can tell them apart from a user's explicit block.
     */
    suspend fun block(
        token: String,
        sender: String,
        automatic: Boolean = false,
    ): Result<Unit> =
        HttpClient
            .post(
                "/blocked-numbers",
                // `source` only for auto-blocks: a user's block stays the exact
                // payload older backends (no `source` in BlockNumberDto,
                // forbidNonWhitelisted) still accept.
                JSONObject()
                    .put("sender", sender)
                    .apply { if (automatic) put("source", "AutoBlock") },
                token,
            ).map { }

    /** DELETE /blocked-numbers/:sender — a 404 (already gone) is not surfaced as failure. */
    suspend fun unblock(
        token: String,
        sender: String,
    ): Result<Unit> =
        HttpClient.delete(
            "/blocked-numbers/${encodePathSegment(sender)}",
            token,
            treat404AsSuccess = true,
        )

    private fun parseList(json: JSONArray): List<BlockedNumberEntry> =
        List(json.length()) { i ->
            val entry = json.getJSONObject(i)
            BlockedNumberEntry(
                id = entry.optString("id"),
                source = entry.optString("source"),
                createdAt = entry.optString("createdAt"),
            )
        }
}
