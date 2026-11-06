package com.bantai.data.remote

import org.json.JSONArray
import org.json.JSONObject

/** Sender familiarity/risk lookup for the conversation header, plus community fraud reports. */
object VerificationApi {
    /**
     * POST /verification/sender/report -- attributable evidence only. A sender
     * becomes confirmed fraud for every user only after several independent
     * users report it and staff validate one of their Scam reports.
     */
    suspend fun reportSender(
        token: String,
        sender: String,
    ): Result<Unit> = HttpClient.post("/verification/sender/report", JSONObject().put("sender", sender), token).map { }

    /**
     * POST /verification/contacts/sync -- the phone numbers in the user's
     * contacts, so the backend's sender check can answer "known_contact"
     * (TrustedSenders.neverAutoBlock relies on it). Snapshot semantics: the
     * server replaces this user's list with exactly what is sent, stores only
     * an HMAC pseudonym per number, and never receives names.
     */
    suspend fun syncContacts(
        token: String,
        phones: List<String>,
    ): Result<Unit> {
        val contacts = JSONArray()
        phones.forEach { contacts.put(JSONObject().put("phone", it)) }
        return HttpClient.post("/verification/contacts/sync", JSONObject().put("contacts", contacts), token).map { }
    }

    data class SenderVerification(
        val familiarity: String,
        val risk: String,
        val organizationName: String? = null,
    )

    suspend fun verifySender(
        token: String,
        sender: String,
    ): Result<SenderVerification> =
        HttpClient
            .get("/verification/sender/${encodePathSegment(sender)}", token)
            .mapCatching { parse(JSONObject(it)) }

    private fun parse(json: JSONObject): SenderVerification {
        val organization = json.optJSONObject("organization")
        return SenderVerification(
            familiarity = json.optString("familiarity", "unknown"),
            risk = json.optString("risk", "unknown"),
            organizationName = organization?.optString("name")?.takeIf { it.isNotEmpty() },
        )
    }
}
