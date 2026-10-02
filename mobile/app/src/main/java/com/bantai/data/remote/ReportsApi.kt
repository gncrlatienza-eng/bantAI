package com.bantai.data.remote

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

    suspend fun submit(
        token: String,
        messageId: String,
        reportedLabel: String,
        notes: String = "",
    ): Result<Unit> {
        val body = JSONObject().put("messageId", messageId).put("reportedLabel", reportedLabel)
        val note = notes.trim().take(MAX_NOTE_LENGTH)
        if (note.isNotEmpty()) body.put("note", note)
        return HttpClient.post("/reports", body, token).map { }
    }
}
