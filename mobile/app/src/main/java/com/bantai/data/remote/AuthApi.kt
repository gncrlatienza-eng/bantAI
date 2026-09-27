package com.bantai.data.remote

import org.json.JSONObject

object AuthApi {
    data class AuthResult(
        val accessToken: String,
    )

    /** Requests the temporary mobile sign-in OTP through the backend's Gmail transport. */
    suspend fun requestMobileEmailOtp(email: String): Result<Unit> =
        HttpClient
            .post(
                "/auth/mobile/request-email-otp",
                JSONObject().put("email", email),
            ).map { }

    /**
     * The backend deliberately omits a `user` object from this response (no
     * PII in the auth payload); the caller already knows the email address it
     * just verified, so only the token is needed.
     */
    suspend fun verifyMobileEmailOtp(
        email: String,
        otp: String,
    ): Result<AuthResult> =
        HttpClient
            .post("/auth/mobile/verify-email-otp", JSONObject().put("email", email).put("otp", otp))
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
