package com.bantai.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.data.SmsIngestPipeline
import com.bantai.data.local.UserData
import com.bantai.data.local.UserPreferences
import com.bantai.data.remote.AuthApi
import com.bantai.data.remote.SmsApi
import com.bantai.util.OnnxBenchmark
import com.bantai.util.isValidName
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class SettingsViewModel(
    application: Application,
) : AndroidViewModel(application) {
    private val userPreferences = UserPreferences(application)

    private val _userData = MutableStateFlow(UserData())
    val userData: StateFlow<UserData> = _userData.asStateFlow()

    private val _editFirstName = MutableStateFlow("")
    val editFirstName: StateFlow<String> = _editFirstName.asStateFlow()

    private val _editLastName = MutableStateFlow("")
    val editLastName: StateFlow<String> = _editLastName.asStateFlow()

    private val _editAvatarColor = MutableStateFlow("#FF6B35")
    val editAvatarColor: StateFlow<String> = _editAvatarColor.asStateFlow()

    private val _profileSaved = MutableStateFlow(false)
    val profileSaved: StateFlow<Boolean> = _profileSaved.asStateFlow()

    // Surfaced when the local save succeeds but syncing the change to the
    // backend fails -- without this, a failed sync looked identical to a
    // successful one and the server-side name silently went stale.
    private val _profileSyncError = MutableStateFlow<String?>(null)
    val profileSyncError: StateFlow<String?> = _profileSyncError.asStateFlow()

    private val _firstNameError = MutableStateFlow<String?>(null)
    val firstNameError: StateFlow<String?> = _firstNameError.asStateFlow()

    private val _lastNameError = MutableStateFlow<String?>(null)
    val lastNameError: StateFlow<String?> = _lastNameError.asStateFlow()

    private val _smishingAlerts = MutableStateFlow(true)
    val smishingAlerts: StateFlow<Boolean> = _smishingAlerts.asStateFlow()

    private val _suspiciousAlerts = MutableStateFlow(true)
    val suspiciousAlerts: StateFlow<Boolean> = _suspiciousAlerts.asStateFlow()

    private val _autoBlockNotice = MutableStateFlow(true)
    val autoBlockNotice: StateFlow<Boolean> = _autoBlockNotice.asStateFlow()

    private val _scanPeriod = MutableStateFlow("daily")
    val scanPeriod: StateFlow<String> = _scanPeriod.asStateFlow()

    private val _recentAlerts = MutableStateFlow<List<SmsApi.AlertSummary>>(emptyList())
    val recentAlerts: StateFlow<List<SmsApi.AlertSummary>> = _recentAlerts.asStateFlow()

    private val _alertsLoading = MutableStateFlow(true)
    val alertsLoading: StateFlow<Boolean> = _alertsLoading.asStateFlow()

    // Debug-only: lets the "Simulate incoming SMS" tool report success/failure
    // without needing a real SMS to arrive first.
    private val _simulateStatus = MutableStateFlow<String?>(null)
    val simulateStatus: StateFlow<String?> = _simulateStatus.asStateFlow()

    init {
        viewModelScope.launch {
            userPreferences.userData.collect { data ->
                _userData.value = data
                _editFirstName.value = data.firstName
                _editLastName.value = data.lastName
                _editAvatarColor.value = data.avatarColor
                _smishingAlerts.value = data.smishingAlerts
                _suspiciousAlerts.value = data.suspiciousAlerts
                _autoBlockNotice.value = data.autoBlockNotice
                _scanPeriod.value = data.scanPeriod
            }
        }
        // Reacts to the token itself rather than reading it once — this ViewModel
        // is hoisted at NavGraph's top level, constructed before the user may
        // have logged in, so a one-shot check would permanently see an empty
        // token and never retry once a real session exists.
        viewModelScope.launch {
            userPreferences.userData
                .map { it.authToken }
                .distinctUntilChanged()
                .collect { token ->
                    if (token.isEmpty()) {
                        _recentAlerts.value = emptyList()
                        _alertsLoading.value = false
                        return@collect
                    }
                    _alertsLoading.value = true
                    SmsApi.getAlerts(token).onSuccess { _recentAlerts.value = it }
                    _alertsLoading.value = false
                }
        }
    }

    fun updateEditFirstName(name: String) {
        _editFirstName.value = name
        _firstNameError.value = null
    }

    fun updateEditLastName(name: String) {
        _editLastName.value = name
        _lastNameError.value = null
    }

    fun cycleAvatarColor() {
        val colors = listOf("#FF6B35", "#5B4FE8", "#00C896", "#0A84FF", "#E91E8C", "#FF3B30", "#00BCD4")
        val idx = colors.indexOf(_editAvatarColor.value)
        _editAvatarColor.value = colors[(idx + 1) % colors.size]
    }

    fun getInitials(): String {
        val first =
            _editFirstName.value
                .trim()
                .firstOrNull()
                ?.uppercase() ?: ""
        val last =
            _editLastName.value
                .trim()
                .firstOrNull()
                ?.uppercase() ?: ""
        return "$first$last".ifEmpty { "?" }
    }

    // Mirrors OnboardingViewModel.validateAndSaveProfile's rules exactly (shared
    // isValidName) — previously this only checked first name for non-empty and
    // never validated either field's characters, so last name in particular
    // could be saved here with digits/symbols/emoji even though onboarding
    // would have rejected the exact same input.
    fun saveProfile(onSuccess: () -> Unit) {
        val trimmedFirst = _editFirstName.value.trim()
        val trimmedLast = _editLastName.value.trim()

        val firstError =
            when {
                trimmedFirst.isEmpty() -> "First name is required"
                !isValidName(trimmedFirst) -> "Name should only contain letters"
                else -> null
            }
        if (firstError != null) {
            _firstNameError.value = firstError
            return
        }
        if (trimmedLast.isNotEmpty() && !isValidName(trimmedLast)) {
            _lastNameError.value = "Name should only contain letters"
            return
        }
        _profileSyncError.value = null
        viewModelScope.launch {
            userPreferences.saveProfile(
                firstName = trimmedFirst,
                lastName = trimmedLast,
                avatarColor = _editAvatarColor.value,
            )
            // Local save always happens so the avatar color and name are never
            // lost, but "saved" only means something to the caller once the
            // backend actually has the new name too -- otherwise GET /auth/me
            // silently disagrees with what the app displays from then on.
            val token = userPreferences.userData.first().authToken
            if (token.isEmpty()) {
                _profileSaved.value = true
                onSuccess()
                return@launch
            }
            AuthApi
                .updateProfile(token, trimmedFirst, trimmedLast)
                .onSuccess {
                    _profileSaved.value = true
                    onSuccess()
                }.onFailure { error ->
                    _profileSyncError.value =
                        error.message ?: "Saved on this device, but couldn't sync to the server."
                }
        }
    }

    fun toggleSmishingAlerts(value: Boolean) {
        _smishingAlerts.value = value
        saveNotificationSettings()
    }

    fun toggleSuspiciousAlerts(value: Boolean) {
        _suspiciousAlerts.value = value
        saveNotificationSettings()
    }

    fun toggleAutoBlockNotice(value: Boolean) {
        _autoBlockNotice.value = value
        saveNotificationSettings()
    }

    private fun saveNotificationSettings() {
        viewModelScope.launch {
            userPreferences.saveNotificationSettings(
                smishingAlerts = _smishingAlerts.value,
                suspiciousAlerts = _suspiciousAlerts.value,
                autoBlockNotice = _autoBlockNotice.value,
            )
        }
    }

    fun setScanPeriod(period: String) {
        _scanPeriod.value = period
        viewModelScope.launch {
            userPreferences.saveScanPeriod(period)
        }
    }

    // Clears only the local session (token + preferences). This must never call
    // DELETE /users/me -- "Sign out" previously did exactly that via a
    // now-removed AuthApi.deleteAccount binding, which permanently deletes the
    // user's row and all their data server-side (see UsersService.deleteMe),
    // even though the confirmation dialog told the user they could just verify
    // their phone number again to come back. There is currently no UI path
    // that performs real account deletion, and adding one needs its own
    // explicit, separately-labeled, clearly-worded confirmation -- not this
    // one.
    fun signOut(onComplete: () -> Unit) {
        viewModelScope.launch {
            userPreferences.clearAll()
            onComplete()
        }
    }

    // Feeds a synthetic message through the same pipeline SmsReceiver uses for a
    // real SMS_DELIVER broadcast, so it's classified/notified/shown identically —
    // used for testing/demos where a real carrier SMS isn't a reliable trigger
    // (e.g. carrier-side smishing filters silently dropping scam-pattern content).
    fun simulateIncomingSms(
        sender: String,
        body: String,
    ) {
        val trimmedSender = sender.trim()
        val trimmedBody = body.trim()
        if (trimmedSender.isEmpty() || trimmedBody.isEmpty()) {
            _simulateStatus.value = "Enter both a sender and a message body."
            return
        }
        viewModelScope.launch {
            _simulateStatus.value = "Sending…"
            val now = System.currentTimeMillis()
            runCatching {
                SmsIngestPipeline.ingest(getApplication(), trimmedSender, trimmedBody, now, now)
            }.onSuccess {
                _simulateStatus.value = "Sent — check Messages/Alerts."
            }.onFailure { e ->
                _simulateStatus.value = "Failed: ${e.message}"
            }
        }
    }

    fun clearSimulateStatus() {
        _simulateStatus.value = null
    }

    // Debug-only: real-device latency check for the on-device-AI feasibility
    // spike (2026-09-16). See OnnxBenchmark.kt -- not wired into real
    // classification, and says nothing about accuracy.
    private val _onnxBenchmarkStatus = MutableStateFlow<String?>(null)
    val onnxBenchmarkStatus: StateFlow<String?> = _onnxBenchmarkStatus.asStateFlow()

    fun runOnnxBenchmark() {
        viewModelScope.launch {
            _onnxBenchmarkStatus.value = "Running 5 warmup + 30 timed passes…"
            val result =
                withContext(Dispatchers.IO) {
                    OnnxBenchmark.run(getApplication())
                }
            _onnxBenchmarkStatus.value =
                result.fold(
                    onSuccess = { r ->
                        "Model: ${r.modelSizeMb.toInt()} MB\n" +
                            "Mean: ${r.meanMs} ms  (min ${r.minMs} / max ${r.maxMs})\n" +
                            "Dummy input, not real tokenization — compute time only."
                    },
                    onFailure = { e -> "Failed: ${e.message}" },
                )
        }
    }

    fun clearOnnxBenchmarkStatus() {
        _onnxBenchmarkStatus.value = null
    }
}
