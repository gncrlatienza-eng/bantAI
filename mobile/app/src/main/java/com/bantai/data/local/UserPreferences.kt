package com.bantai.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import java.io.IOException

val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "bantai_prefs")

data class UserData(
    val firstName: String = "",
    val lastName: String = "",
    val avatarColor: String = "#FF6B35",
    val onboardingComplete: Boolean = false,
    val scanPeriod: String = "daily",
    val smishingAlerts: Boolean = true,
    val suspiciousAlerts: Boolean = true,
    val autoBlockNotice: Boolean = true,
)

class UserPreferences(private val context: Context) {

    private object Keys {
        val FIRST_NAME = stringPreferencesKey("first_name")
        val LAST_NAME = stringPreferencesKey("last_name")
        val AVATAR_COLOR = stringPreferencesKey("avatar_color")
        val ONBOARDING_COMPLETE = booleanPreferencesKey("onboarding_complete")
        val SCAN_PERIOD = stringPreferencesKey("scan_period")
        val SMISHING_ALERTS = booleanPreferencesKey("smishing_alerts")
        val SUSPICIOUS_ALERTS = booleanPreferencesKey("suspicious_alerts")
        val AUTO_BLOCK_NOTICE = booleanPreferencesKey("auto_block_notice")
    }

    val userData: Flow<UserData> = context.dataStore.data
        .catch { exception ->
            if (exception is IOException) emit(emptyPreferences())
            else throw exception
        }
        .map { prefs ->
            UserData(
                firstName = prefs[Keys.FIRST_NAME] ?: "",
                lastName = prefs[Keys.LAST_NAME] ?: "",
                avatarColor = prefs[Keys.AVATAR_COLOR] ?: "#FF6B35",
                onboardingComplete = prefs[Keys.ONBOARDING_COMPLETE] ?: false,
                scanPeriod = prefs[Keys.SCAN_PERIOD] ?: "daily",
                smishingAlerts = prefs[Keys.SMISHING_ALERTS] ?: true,
                suspiciousAlerts = prefs[Keys.SUSPICIOUS_ALERTS] ?: true,
                autoBlockNotice = prefs[Keys.AUTO_BLOCK_NOTICE] ?: true,
            )
        }

    suspend fun saveProfile(firstName: String, lastName: String, avatarColor: String) {
        val safeFirst = firstName.trim().take(50)
        val safeLast = lastName.trim().take(50)
        val safeColor = if (Regex("^#[0-9A-Fa-f]{6}$").matches(avatarColor)) avatarColor else "#FF6B35"
        context.dataStore.edit { prefs ->
            prefs[Keys.FIRST_NAME] = safeFirst
            prefs[Keys.LAST_NAME] = safeLast
            prefs[Keys.AVATAR_COLOR] = safeColor
        }
    }

    suspend fun setOnboardingComplete() {
        context.dataStore.edit { prefs ->
            prefs[Keys.ONBOARDING_COMPLETE] = true
        }
    }

    suspend fun saveScanPeriod(period: String) {
        val safePeriod = when (period) { "weekly", "monthly" -> period; else -> "daily" }
        context.dataStore.edit { prefs ->
            prefs[Keys.SCAN_PERIOD] = safePeriod
        }
    }

    suspend fun saveNotificationSettings(
        smishingAlerts: Boolean,
        suspiciousAlerts: Boolean,
        autoBlockNotice: Boolean,
    ) {
        context.dataStore.edit { prefs ->
            prefs[Keys.SMISHING_ALERTS] = smishingAlerts
            prefs[Keys.SUSPICIOUS_ALERTS] = suspiciousAlerts
            prefs[Keys.AUTO_BLOCK_NOTICE] = autoBlockNotice
        }
    }

    suspend fun clearAll() {
        context.dataStore.edit { it.clear() }
    }
}
