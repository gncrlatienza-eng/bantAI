package com.bantai.data.remote

import com.bantai.BuildConfig

/**
 * Shared connection settings for every backend call.
 *
 * The base URL is injected at build time (`BACKEND_BASE_URL` in
 * app/build.gradle.kts), so switching setups needs no source edit:
 *
 *   Debug default — http://<laptop LAN IP>:3000/api, detected at build time;
 *                   phone on the same wifi, no USB/adb needed
 *   USB device    — -PbantaiBackendUrl=http://localhost:3000/api, after `adb reverse tcp:3000 tcp:3000`
 *   Emulator      — -PbantaiBackendUrl=http://10.0.2.2:3000/api
 *   Release       — -PbantaiReleaseBackendUrl=https://<deployed host>/api
 *
 * Debug builds allow plain HTTP only to localhost, 10.0.2.2, and that one
 * build-time host (generated from src/debug/network_security_config.template.xml).
 */
object ApiConfig {
    val BASE_URL: String = BuildConfig.BACKEND_BASE_URL

    /** Interactive calls made from a screen, where the user is waiting. */
    const val DEFAULT_TIMEOUT_MS = 10_000

    /**
     * Calls made from SmsReceiver. A broadcast receiver holding the wake lock
     * via goAsync() is killed after roughly 10s, and the local-heuristic
     * fallback still has to run afterwards — so the network half of that budget
     * is capped well short of the limit.
     */
    const val SMS_TIMEOUT_MS = 5_000

    /**
     * Calls made from the debug "Simulate incoming SMS" tool. Unlike
     * SmsReceiver, this runs in an ordinary ViewModel coroutine with no
     * goAsync() deadline, so it can afford to actually wait out a slow
     * classification instead of racing it. Needs to comfortably exceed the
     * backend's own 5s timeout on the AI service call (ai.service.ts) plus
     * its heuristic-fallback and DB-write overhead.
     */
    const val SIMULATE_TIMEOUT_MS = 15_000

    /**
     * AI Summary sheet (WBS 4.3.11). Needs to comfortably exceed the backend's
     * own 8s timeout on the AI service's /summarize call (ai.service.ts).
     */
    const val SUMMARIZE_TIMEOUT_MS = 12_000
}
