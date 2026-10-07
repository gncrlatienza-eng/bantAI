package com.bantai.data.remote

import org.json.JSONObject

object AuthApi {
    data class AuthResult(
        val accessToken: String,
    )

    /** Requests a mobile sign-in OTP through the backend's Semaphore SMS transport. */
    suspend fun requestPhoneOtp(phone: String): Result<Unit> =
        HttpClient
            .post(
                "/auth/request-otp",
                JSONObject().put("phone", phone),
            ).map { }

    /**
     * The backend deliberately omits a `user` object from this response so the
     * auth payload contains no PII. The caller already knows the phone number
     * it verified, so only the token is needed.
     */
    suspend fun verifyPhoneOtp(
        phone: String,
        otp: String,
    ): Result<AuthResult> =
        HttpClient
            .post("/auth/verify-otp", JSONObject().put("phone", phone).put("otp", otp))
            .mapCatching { body ->
                AuthResult(accessToken = JSONObject(body).getString("access_token"))
            }

    data class Profile(
        val firstName: String,
        val lastName: String,
    )

    /** The signed-in account's saved name, so signing back in on this phone restores it. */
    suspend fun me(token: String): Result<Profile> =
        HttpClient.get("/auth/me", token = token).mapCatching { body ->
            val json = JSONObject(body)
            Profile(
                firstName = json.optString("firstName").takeUnless { json.isNull("firstName") }.orEmpty(),
                lastName = json.optString("lastName").takeUnless { json.isNull("lastName") }.orEmpty(),
            )
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

    /**
     * DELETE /users/me: permanently removes the account and every record the
     * backend holds for it (UsersService.deleteMe). Only ever called from the
     * Delete account confirmation, never from Sign out. A 404 means it's
     * already gone, which is the outcome the user asked for.
     */
    suspend fun deleteAccount(token: String): Result<Unit> {
        val path = "/users/me"
        return HttpClient.delete(path, token, treat404AsSuccess = true)
    }
}
