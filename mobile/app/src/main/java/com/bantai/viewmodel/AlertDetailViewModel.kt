package com.bantai.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.data.local.UserPreferences
import com.bantai.data.remote.SmsApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class AlertDetailViewModel(
    application: Application,
) : AndroidViewModel(application) {
    private val userPreferences = UserPreferences(application)

    private val _alert = MutableStateFlow<SmsApi.AlertSummary?>(null)
    val alert: StateFlow<SmsApi.AlertSummary?> = _alert.asStateFlow()

    private val _indicators = MutableStateFlow<List<SmsApi.IndicatorTag>>(emptyList())
    val indicators: StateFlow<List<SmsApi.IndicatorTag>> = _indicators.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    fun load(messageId: String) {
        // Two legacy entry points (the AI-summary shortcut and the suspicious-thread
        // banner in MessageDetailScreen/SuspiciousDetailScreen) navigate here with no
        // specific message tracked — show an honest empty state rather than guessing.
        if (messageId.isBlank()) {
            _isLoading.value = false
            _alert.value = null
            _errorMessage.value = null
            return
        }

        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null

            val token = userPreferences.userData.first().authToken
            if (token.isEmpty()) {
                _isLoading.value = false
                _errorMessage.value = "Sign in to see this alert"
                return@launch
            }

            // There is no single-alert-by-id endpoint yet — GET /sms/alerts returns
            // the full list, so the matching alert for this messageId is found here.
            SmsApi
                .getAlerts(token)
                .onSuccess { alerts -> _alert.value = alerts.find { it.messageId == messageId } }
                .onFailure { error -> _errorMessage.value = error.message ?: "Could not reach the server" }

            // Indicators failing is non-fatal: an empty list just means no SHAP bars render.
            SmsApi
                .getIndicators(token, messageId)
                .onSuccess { tags -> _indicators.value = tags }

            _isLoading.value = false
        }
    }
}
