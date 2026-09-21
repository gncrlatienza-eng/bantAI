package com.bantai.data.remote

import org.json.JSONObject

object AuthApi {
    data class AuthResult(
        val accessToken: String,
    )

    /**
     * Requests an OTP through the backend's configured SMS provider.
     * The backend owns delivery and verification; the mobile client does not
     * need Firebase Auth credentials or a Firebase ID-token exchange.
     */
    suspend fun requestOtp(phone: String): Result<Unit> =
        HttpClient
            .post(
                "/auth/request-otp",
                JSONObject().put("phone", phone),
            ).map { }

    /**
     * The backend deliberately omits a `user` object from this response (no
     * PII in the auth payload — see auth.service.spec.ts); the caller already
     * knows the phone number it just verified, so only the token is needed.
     */
    suspend fun verifyOtp(
        phone: String,
        otp: String,
    ): Result<AuthResult> =
        HttpClient
            .post("/auth/verify-otp", JSONObject().put("phone", phone).put("otp", otp))
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
