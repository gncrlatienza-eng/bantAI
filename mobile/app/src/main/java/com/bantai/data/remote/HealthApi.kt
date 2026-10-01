package com.bantai.data.remote

/**
 * Debug "Backend connection" check (Settings → Developer Tools). Hits the
 * backend's unauthenticated `GET /health`, so a wrong/stale BASE_URL, a
 * firewall, or wifi client isolation shows up directly instead of as a vague
 * "Could not reach the server" on Alerts/Campaigns.
 */
object HealthApi {
    suspend fun check(): Result<Unit> = HttpClient.get("/health", token = null).map { }
}
