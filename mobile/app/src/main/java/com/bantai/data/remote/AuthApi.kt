package com.bantai.data.remote

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

object AuthApi {
    private val BASE_URL get() = ApiConfig.BASE_URL

    data class AuthResult(
        val accessToken: String,
    )

    class ApiException(
        message: String,
    ) : Exception(message)

    suspend fun requestOtp(phone: String): Result<Unit> = post("/auth/request-otp", JSONObject().put("phone", phone)).map { }

    /**
     * The backend deliberately omits a `user` object from this response (no
     * PII in the auth payload — see auth.service.spec.ts); the caller already
     * knows the phone number it just verified, so only the token is needed.
     */
    suspend fun verifyOtp(
        phone: String,
        otp: String,
    ): Result<AuthResult> =
        post("/auth/verify-otp", JSONObject().put("phone", phone).put("otp", otp))
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
        return post("/users/me", body, method = "PUT", token = token).map { }
    }

    private suspend fun post(
        path: String,
        body: JSONObject,
        method: String = "POST",
        token: String? = null,
    ): Result<String> =
        withContext(Dispatchers.IO) {
            runCatching {
                val connection = URL(BASE_URL + path).openConnection() as HttpURLConnection
                try {
                    connection.requestMethod = method
                    connection.setRequestProperty("Content-Type", "application/json")
                    if (token != null) connection.setRequestProperty("Authorization", "Bearer $token")
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
                    text
                } finally {
                    connection.disconnect()
                }
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
