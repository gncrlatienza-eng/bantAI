package com.bantai.data

import android.content.Context
import android.net.Uri
import com.bantai.BuildConfig
import com.bantai.container
import com.bantai.data.remote.SmsApi
import com.bantai.util.BlockHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate

// Up to 50 pages of 100 alerts; far beyond any real account, but bounded.
private const val EXPORT_MAX_ALERT_PAGES = 50

/**
 * Settings > Privacy & data > Download my data. There's no backend export
 * endpoint (the server keeps only pseudonymous telemetry), so the export is
 * assembled on the phone from what BantAI holds about the user: profile,
 * settings, blocked senders, and alert history. Written as JSON to a file the
 * user picks with the system "Save as" screen (Storage Access Framework), which
 * needs no storage permission on any Android version the app supports.
 */
object DataExport {
    fun suggestedFileName(): String = "bantai-data-${LocalDate.now()}.json"

    /** Builds the export and writes it to [target]. Failure means nothing usable was written. */
    suspend fun writeTo(
        context: Context,
        target: Uri,
    ): Result<Unit> =
        runCatching {
            val json = build(context).toString(JSON_INDENT)
            withContext(Dispatchers.IO) {
                val stream = context.contentResolver.openOutputStream(target) ?: error("Couldn't open the file")
                stream.use { it.write(json.toByteArray(Charsets.UTF_8)) }
            }
        }

    private suspend fun build(context: Context): JSONObject {
        val prefs = context.container.userPreferences
        val user = prefs.userData.first()
        return JSONObject()
            .put("exportedAt", Instant.now().toString())
            .put("app", JSONObject().put("name", "BantAI").put("version", BuildConfig.VERSION_NAME))
            .put(
                "profile",
                JSONObject()
                    .put("firstName", user.firstName)
                    .put("lastName", user.lastName)
                    .put("email", user.emailAddress)
                    .put("phoneNumber", user.phoneNumber),
            ).put(
                "settings",
                JSONObject()
                    .put("theme", prefs.themeMode.first().ifEmpty { "default" })
                    .put("textSize", prefs.textScale.first().ifEmpty { "default" })
                    .put("scanPeriod", user.scanPeriod)
                    .put("smishingAlerts", user.smishingAlerts)
                    .put("suspiciousAlerts", user.suspiciousAlerts)
                    .put("spamAlerts", user.spamAlerts)
                    .put("autoBlockNotice", user.autoBlockNotice),
            ).put("blockedSenders", blockedSenders(context))
            .put("alerts", alerts(context, user.authToken))
    }

    private suspend fun blockedSenders(context: Context): JSONObject {
        val store = context.container.blockedSendersStore.current()
        val onDevice = withContext(Dispatchers.IO) { BlockHelper.getBlockedNumbers(context).map { it.number } }
        return JSONObject()
            .put("blockedOnThisPhone", JSONArray(onDevice))
            .put("blockedByBantAI", JSONArray(store.blocked.sorted()))
            .put("unblockedByYou", JSONArray(store.userUnblocked.sorted()))
    }

    // Alert history from the server, with each message's sender and text filled
    // in from this phone (the server never stores either). Offline or signed
    // out, the export still succeeds and says why alerts are missing.
    private suspend fun alerts(
        context: Context,
        token: String,
    ): JSONObject {
        if (token.isEmpty()) return JSONObject().put("note", "Not signed in, so alert history wasn't included.")
        // A data export should be complete, not just the newest 100.
        val fetched = SmsApi.getAlerts(token, maxPages = EXPORT_MAX_ALERT_PAGES)
        val list =
            fetched.getOrElse {
                return JSONObject().put("note", "Couldn't reach BantAI's server, so alert history wasn't included.")
            }
        val local = withContext(Dispatchers.IO) { context.container.smsRepository.localAlertsOnly(list) }
        val items =
            JSONArray(
                local.map { alert ->
                    JSONObject()
                        .put("receivedAt", alert.receivedAt)
                        .put("sender", alert.sender)
                        .put("message", alert.body)
                        .put("verdict", alert.label ?: JSONObject.NULL)
                        .put("confidence", alert.score ?: JSONObject.NULL)
                        .put("bucket", alert.bucket ?: JSONObject.NULL)
                },
            )
        return JSONObject().put("count", local.size).put("items", items)
    }

    private const val JSON_INDENT = 2
}
