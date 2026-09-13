package com.bantai.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.data.local.UserPreferences
import com.bantai.data.remote.SmsApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

private const val ALERTS_POLL_INTERVAL_MS = 5_000L

class AlertsViewModel(
    application: Application,
) : AndroidViewModel(application) {
    private val userPreferences = UserPreferences(application)

    private val _alerts = MutableStateFlow<List<SmsApi.AlertSummary>>(emptyList())
    val alerts: StateFlow<List<SmsApi.AlertSummary>> = _alerts.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private var loadJob: Job? = null

    init {
        loadAlerts()
        // Polling lives here (viewModelScope) rather than in AlertsScreen's own
        // composition, so the Alerts tab's unread badge stays live even while
        // the user is on a different tab — not just while this screen itself
        // happens to be on screen.
        viewModelScope.launch {
            while (isActive) {
                delay(ALERTS_POLL_INTERVAL_MS)
                loadAlerts(silent = true)
            }
        }
    }

    /**
     * @param silent true for background polling refreshes — skips the loading
     *   spinner so an already-populated list doesn't flash empty every poll.
     */
    fun loadAlerts(silent: Boolean = false) {
        // Cancels any in-flight fetch first so a slow earlier response can't land
        // after a newer one and overwrite it with stale data.
        loadJob?.cancel()
        loadJob =
            viewModelScope.launch {
                if (!silent) _isLoading.value = true
                _errorMessage.value = null

                val token = userPreferences.userData.first().authToken
                if (token.isEmpty()) {
                    _isLoading.value = false
                    _errorMessage.value = "Sign in to see alerts"
                    return@launch
                }

                SmsApi
                    .getAlerts(token)
                    .onSuccess { alerts -> _alerts.value = alerts }
                    .onFailure { error ->
                        if (!silent) _errorMessage.value = error.message ?: "Could not reach the server"
                    }
                if (!silent) _isLoading.value = false
            }
    }
}
