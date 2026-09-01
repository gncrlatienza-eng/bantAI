package com.bantai.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.data.SmsIngestPipeline
import com.bantai.data.local.UserData
import com.bantai.data.local.UserPreferences
import com.bantai.data.remote.SmsApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

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
        viewModelScope.launch {
            val token = userPreferences.userData.first().authToken
            if (token.isEmpty()) {
                _alertsLoading.value = false
                return@launch
            }
            SmsApi.getAlerts(token).onSuccess { _recentAlerts.value = it }
            _alertsLoading.value = false
        }
    }

    fun updateEditFirstName(name: String) {
        _editFirstName.value = name
    }

    fun updateEditLastName(name: String) {
        _editLastName.value = name
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

    fun saveProfile(onSuccess: () -> Unit) {
        val trimmed = _editFirstName.value.trim()
        if (trimmed.isEmpty()) return
        viewModelScope.launch {
            userPreferences.saveProfile(
                firstName = trimmed,
                lastName = _editLastName.value.trim(),
                avatarColor = _editAvatarColor.value,
            )
            _profileSaved.value = true
            onSuccess()
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

    fun deleteAccount(onComplete: () -> Unit) {
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
}
