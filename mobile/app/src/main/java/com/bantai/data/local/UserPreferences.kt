package com.bantai.data.local

import android.content.Context
import android.util.Log
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import com.bantai.data.model.SCAN_PERIODS
import com.bantai.data.model.SCAN_PERIOD_ALL
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import java.io.IOException

private const val TAG = "UserPreferences"

val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "bantai_prefs")

data class UserData(
    val firstName: String = "",
    val lastName: String = "",
    val avatarColor: String = "#FF6B35",
    val onboardingComplete: Boolean = false,
    val scanPeriod: String = SCAN_PERIOD_ALL,
    val smishingAlerts: Boolean = true,
    val suspiciousAlerts: Boolean = true,
    val spamAlerts: Boolean = true,
    val autoBlockNotice: Boolean = true,
    // Off by default: asking the carrier for delivery reports is extra traffic
    // some carriers don't support, so it's the user's choice to turn on.
    val deliveryReports: Boolean = false,
    val phoneNumber: String = "",
    val emailAddress: String = "",
    val authToken: String = "",
)

@Suppress("TooManyFunctions") // one save per stored setting
class UserPreferences(
    private val context: Context,
) {
    private object Keys {
        val FIRST_NAME = stringPreferencesKey("first_name")
        val LAST_NAME = stringPreferencesKey("last_name")
        val AVATAR_COLOR = stringPreferencesKey("avatar_color")
        val ONBOARDING_COMPLETE = booleanPreferencesKey("onboarding_complete")
        val SCAN_PERIOD = stringPreferencesKey("scan_period")
        val SMISHING_ALERTS = booleanPreferencesKey("smishing_alerts")
        val SUSPICIOUS_ALERTS = booleanPreferencesKey("suspicious_alerts")
        val SPAM_ALERTS = booleanPreferencesKey("spam_alerts")
        val AUTO_BLOCK_NOTICE = booleanPreferencesKey("auto_block_notice")
        val DELIVERY_REPORTS = booleanPreferencesKey("delivery_reports")
        val PHONE_NUMBER = stringPreferencesKey("phone_number")
        val EMAIL_ADDRESS = stringPreferencesKey("email_address")
        val THEME_MODE = stringPreferencesKey("theme_mode")
        val TEXT_SCALE = stringPreferencesKey("text_scale")
        val MY_NUMBER = stringPreferencesKey("my_number")
        val SHOW_SCAM_WAVES_TAB = booleanPreferencesKey("show_scam_waves_tab")
    }

    // The JWT is a bearer credential, not just text, so it's kept out of
    // DataStore's plain file — see SecureTokenStore.
    private val secureTokenStore = SecureTokenStore(context)

    val userData: Flow<UserData> =
        combine(
            context.dataStore.data
                .catch { exception ->
                    if (exception is IOException) {
                        Log.e(TAG, "DataStore read failed, resetting to defaults", exception)
                        emit(emptyPreferences())
                    } else {
                        throw exception
                    }
                },
            secureTokenStore.tokenFlow,
        ) { prefs, token ->
            UserData(
                firstName = prefs[Keys.FIRST_NAME] ?: "",
                lastName = prefs[Keys.LAST_NAME] ?: "",
                avatarColor = prefs[Keys.AVATAR_COLOR] ?: "#FF6B35",
                onboardingComplete = prefs[Keys.ONBOARDING_COMPLETE] ?: false,
                scanPeriod = prefs[Keys.SCAN_PERIOD] ?: SCAN_PERIOD_ALL,
                smishingAlerts = prefs[Keys.SMISHING_ALERTS] ?: true,
                suspiciousAlerts = prefs[Keys.SUSPICIOUS_ALERTS] ?: true,
                spamAlerts = prefs[Keys.SPAM_ALERTS] ?: true,
                autoBlockNotice = prefs[Keys.AUTO_BLOCK_NOTICE] ?: true,
                deliveryReports = prefs[Keys.DELIVERY_REPORTS] ?: false,
                phoneNumber = prefs[Keys.PHONE_NUMBER] ?: "",
                emailAddress = prefs[Keys.EMAIL_ADDRESS] ?: "",
                authToken = token,
            )
        }

    suspend fun savePhoneAuth(
        token: String,
        phoneNumber: String,
    ) {
        secureTokenStore.saveToken(token)
        context.dataStore.edit { prefs ->
            prefs[Keys.PHONE_NUMBER] = phoneNumber
            // A mobile session has one authoritative sign-in identity. Remove
            // the old email-backed value when upgrading an App 1.1 install.
            prefs.remove(Keys.EMAIL_ADDRESS)
        }
    }

    /** Clears only the session token — used when the backend rejects it (401), not a full sign-out. */
    fun clearAuthToken() {
        secureTokenStore.clear()
    }

    suspend fun saveProfile(
        firstName: String,
        lastName: String,
        avatarColor: String,
    ) {
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
        val safePeriod = period.takeIf { it in SCAN_PERIODS } ?: SCAN_PERIOD_ALL
        context.dataStore.edit { prefs ->
            prefs[Keys.SCAN_PERIOD] = safePeriod
        }
    }

    suspend fun saveNotificationSettings(
        smishingAlerts: Boolean,
        suspiciousAlerts: Boolean,
        spamAlerts: Boolean,
        autoBlockNotice: Boolean,
    ) {
        context.dataStore.edit { prefs ->
            prefs[Keys.SMISHING_ALERTS] = smishingAlerts
            prefs[Keys.SUSPICIOUS_ALERTS] = suspiciousAlerts
            prefs[Keys.SPAM_ALERTS] = spamAlerts
            prefs[Keys.AUTO_BLOCK_NOTICE] = autoBlockNotice
        }
    }

    suspend fun saveDeliveryReports(enabled: Boolean) {
        context.dataStore.edit { prefs -> prefs[Keys.DELIVERY_REPORTS] = enabled }
    }

    // Off by default: most people only need Messages and Alerts; the Scam
    // Waves tab (campaigns) is for whoever wants to see the bigger picture.
    // Read on its own like themeMode, so the tab bar doesn't wait on the token store.
    val showScamWavesTab: Flow<Boolean> =
        context.dataStore.data
            .catch { emit(emptyPreferences()) }
            .map { it[Keys.SHOW_SCAM_WAVES_TAB] ?: false }

    suspend fun saveShowScamWavesTab(show: Boolean) {
        context.dataStore.edit { prefs -> prefs[Keys.SHOW_SCAM_WAVES_TAB] = show }
    }

    // Read on its own, without userData's token store, so MainActivity can
    // pick the theme before the first frame without touching the Keystore.
    // "system" / "light" / "dark" -- see ThemeMode; blank if never chosen.
    val themeMode: Flow<String> =
        context.dataStore.data
            .catch { emit(emptyPreferences()) }
            .map { it[Keys.THEME_MODE] ?: "" }

    suspend fun saveThemeMode(mode: String) {
        context.dataStore.edit { prefs -> prefs[Keys.THEME_MODE] = mode }
    }

    // "default" / "large" / "larger" -- see TextScale; blank if never chosen.
    // Read by MainActivity alongside the theme, for the same reason.
    val textScale: Flow<String> =
        context.dataStore.data
            .catch { emit(emptyPreferences()) }
            .map { it[Keys.TEXT_SCALE] ?: "" }

    suspend fun saveTextScale(scale: String) {
        context.dataStore.edit { prefs -> prefs[Keys.TEXT_SCALE] = scale }
    }

    // This phone's own number (Edit Profile → My number), blank if not given.
    // Belongs to the phone like the theme: kept across sign-in and sign-out.
    val myNumber: Flow<String> =
        context.dataStore.data
            .catch { emit(emptyPreferences()) }
            .map { it[Keys.MY_NUMBER] ?: "" }

    suspend fun saveMyNumber(number: String) {
        context.dataStore.edit { prefs ->
            if (number.isBlank()) prefs.remove(Keys.MY_NUMBER) else prefs[Keys.MY_NUMBER] = number
        }
    }

    // Appearance and the finished device setup (default SMS app, permissions,
    // terms) belong to the phone, not the account -- signing out shouldn't reset
    // the theme or send the user through setup again, only back to sign-in.
    suspend fun clearAll() {
        secureTokenStore.clear()
        context.dataStore.edit { prefs ->
            val theme = prefs[Keys.THEME_MODE]
            val textScale = prefs[Keys.TEXT_SCALE]
            val myNumber = prefs[Keys.MY_NUMBER]
            val setupDone = prefs[Keys.ONBOARDING_COMPLETE]
            prefs.clear()
            if (myNumber != null) prefs[Keys.MY_NUMBER] = myNumber
            if (theme != null) prefs[Keys.THEME_MODE] = theme
            if (textScale != null) prefs[Keys.TEXT_SCALE] = textScale
            if (setupDone != null) prefs[Keys.ONBOARDING_COMPLETE] = setupDone
        }
    }
}
