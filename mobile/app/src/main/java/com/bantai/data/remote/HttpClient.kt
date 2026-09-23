package com.bantai.data.remote

import com.bantai.data.AuthEventBus
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

private const val HTTP_OK_MIN = 200
private const val HTTP_OK_MAX = 299
private const val HTTP_UNAUTHORIZED = 401
private const val HTTP_NOT_FOUND = 404

/** Carries the HTTP status alongside the message so callers can tell a 401 apart from any other failure. */
class ApiException(
    val status: Int,
    message: String,
) : Exception(message)

/**
 * ApiException's message is always safe to show a user -- it's either the
 * backend's own validation message or a generic "Request failed (HTTP …)"
 * (see HttpClient.parseErrorMessage). Any other Throwable reaching here
 * (timeouts, DNS failures, JSON parse errors) carries a raw exception message
 * never meant for display, so it falls back to a safe, caller-supplied string.
 */
fun Throwable.toUserMessage(fallback: String): String = if (this is ApiException) (message ?: fallback) else fallback

/**
 * Shared HTTP plumbing for every backend API client (AuthApi, SmsApi,
 * CampaignsApi, BlockedNumbersApi, SummarizeApi) — a plain HttpURLConnection
 * wrapper rather than Retrofit, matching the project's existing style. Each
 * client used to hand-roll its own near-identical copy of this; consolidating
 * it means a 401 is detected and reacted to in exactly one place instead of
 * five, and it had already started to drift (only one of the five copies
 * special-cased a 404 on delete).
 */
internal object HttpClient {
    suspend fun get(
        path: String,
        token: String,
        timeoutMs: Int = ApiConfig.DEFAULT_TIMEOUT_MS,
    ): Result<String> = request("GET", path, token = token, timeoutMs = timeoutMs)

    suspend fun post(
        path: String,
        body: JSONObject,
        token: String? = null,
        timeoutMs: Int = ApiConfig.DEFAULT_TIMEOUT_MS,
    ): Result<String> = request("POST", path, body = body, token = token, timeoutMs = timeoutMs)

    suspend fun put(
        path: String,
        body: JSONObject,
        token: String? = null,
        timeoutMs: Int = ApiConfig.DEFAULT_TIMEOUT_MS,
    ): Result<String> = request("PUT", path, body = body, token = token, timeoutMs = timeoutMs)

    /** @param treat404AsSuccess a 404 means the row is already gone — the caller's desired end state, not a failure. */
    suspend fun delete(
        path: String,
        token: String,
        treat404AsSuccess: Boolean = false,
        timeoutMs: Int = ApiConfig.DEFAULT_TIMEOUT_MS,
    ): Result<Unit> =
        request("DELETE", path, token = token, timeoutMs = timeoutMs).fold(
            onSuccess = { Result.success(Unit) },
            onFailure = { e ->
                if (treat404AsSuccess && e is ApiException && e.status == HTTP_NOT_FOUND) {
                    Result.success(Unit)
                } else {
                    Result.failure(e)
                }
            },
        )

    private suspend fun request(
        method: String,
        path: String,
        body: JSONObject? = null,
        token: String? = null,
        timeoutMs: Int,
    ): Result<String> =
        withContext(Dispatchers.IO) {
            runCatching {
                val connection = URL(ApiConfig.BASE_URL + path).openConnection() as HttpURLConnection
                try {
                    connection.requestMethod = method
                    if (token != null) connection.setRequestProperty("Authorization", "Bearer $token")
                    connection.connectTimeout = timeoutMs
                    connection.readTimeout = timeoutMs
                    if (body != null) {
                        connection.setRequestProperty("Content-Type", "application/json")
                        connection.doOutput = true
                        connection.outputStream.use { it.write(body.toString().toByteArray()) }
                    }

                    val status = connection.responseCode
                    val isOk = status in HTTP_OK_MIN..HTTP_OK_MAX

                    // A 401 means this token is dead regardless of which endpoint hit it —
                    // surface that once, centrally, rather than each of the 5+ call sites
                    // needing its own check.
                    if (status == HTTP_UNAUTHORIZED) AuthEventBus.notifySessionExpired()

                    val text =
                        (if (isOk) connection.inputStream else connection.errorStream)
                            ?.bufferedReader()
                            ?.use { it.readText() }
                            .orEmpty()
                    if (!isOk) throw ApiException(status, parseErrorMessage(text, status))
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
