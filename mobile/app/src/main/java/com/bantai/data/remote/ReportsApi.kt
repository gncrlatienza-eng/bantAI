package com.bantai.data.remote

import org.json.JSONArray
import org.json.JSONObject

/**
 * Submits a user's report on a classified message (POST /api/reports,
 * JWT-guarded): a messageId, the label the user says is right, and the
 * optional "Additional notes" from `TakeActionScreen`. The backend privacy-masks
 * the note before storing it and moves the message's alert to Reported, so the
 * report shows on the Admin portal's Reports page with the masked message.
 */
object ReportsApi {
    // Matches SubmitReportDto's @MaxLength on `note`.
    private const val MAX_NOTE_LENGTH = 500

    /**
     * @param groupId shared by every message the user selected and reported
     *   together, so Reported (here and on the Admin portal) lists them as one
     *   entry. Null for a single message.
     */
    suspend fun submit(
        token: String,
        messageId: String,
        reportedLabel: String,
        notes: String = "",
        groupId: String? = null,
    ): Result<Unit> {
        val body = JSONObject().put("messageId", messageId).put("reportedLabel", reportedLabel)
        val note = notes.trim().take(MAX_NOTE_LENGTH)
        if (note.isNotEmpty()) body.put("note", note)
        if (groupId != null) body.put("groupId", groupId)
        return HttpClient.post("/reports", body, token).map { }
    }

    /**
     * GET /reports/mine -- every report this user filed, newest first, shaped
     * like alerts. Includes reports on messages the model called safe, which
     * never had an alert and so weren't in GET /sms/alerts.
     */
    suspend fun mine(token: String): Result<List<SmsApi.AlertSummary>> {
        val response = HttpClient.get("/reports/mine", token)
        return runCatching { SmsApi.parseAlerts(JSONArray(response.getOrThrow())) }
    }
}
