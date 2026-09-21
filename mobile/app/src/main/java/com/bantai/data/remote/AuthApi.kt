package com.bantai.data.remote

import org.json.JSONObject

object AuthApi {
    data class AuthResult(
        val accessToken: String,
    )

    /**
     * Exchanges a Firebase phone-auth ID token for a bantAI JWT. Firebase itself
     * sends and verifies the SMS code on-device (see OnboardingViewModel) — the
     * backend never sees the OTP, only this token, which it verifies against
     * FIREBASE_PROJECT_ID. The backend deliberately omits a `user` object from
     * the response (no PII in the auth payload — see auth.service.spec.ts).
     */
    suspend fun exchangeFirebaseToken(idToken: String): Result<AuthResult> =
        HttpClient
            .post("/auth/mobile/firebase", JSONObject().put("idToken", idToken))
            .mapCatching { body ->
                AuthResult(accessToken = JSONObject(body).getString("access_token"))
            }

    suspend fun updateProfile(
        token: String,
        firstName: String,
        lastName: String,
    ): Result<Unit> {
        val body = JSONObject().put("firstName", firstName)
        if (lastName.isNotEmpty()) body.put("lastName", lastName)
        return HttpClient.put("/users/me", body, token = token).map { }
    }
}
