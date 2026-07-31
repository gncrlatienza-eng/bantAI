package com.bantai.data.remote

import com.bantai.BuildConfig

/**
 * Shared connection settings for every backend call.
 *
 * The base URL is injected at build time (`BACKEND_BASE_URL` in
 * app/build.gradle.kts) so switching between an emulator and a USB-connected
 * device needs no source edit:
 *
 *   USB device — http://localhost:3000/api, after `adb reverse tcp:3000 tcp:3000`
 *   Emulator   — http://10.0.2.2:3000/api
 *
 * Those two hosts are the only ones allowed to use plain HTTP; see
 * res/xml/network_security_config.xml before pointing this at a LAN address.
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
}
