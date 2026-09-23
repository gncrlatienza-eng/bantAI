package com.bantai.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.data.SmsRepository
import com.bantai.data.local.UserPreferences
import com.bantai.data.remote.SmsApi
import com.bantai.data.remote.toUserMessage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class AlertDetailViewModel(
    application: Application,
) : AndroidViewModel(application) {
    private val userPreferences = UserPreferences(application)
    private val smsRepository = SmsRepository(application)

    private val _alert = MutableStateFlow<SmsApi.AlertSummary?>(null)
    val alert: StateFlow<SmsApi.AlertSummary?> = _alert.asStateFlow()

    private val _indicators = MutableStateFlow<List<SmsApi.IndicatorTag>>(emptyList())
    val indicators: StateFlow<List<SmsApi.IndicatorTag>> = _indicators.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    // The backend never sends a real sender (AlertSummary.sender is always "" --
    // see SmsApi.parseAlert's privacy placeholder), so Block from this screen
    // always failed with "Can't block — no number for this message." When this
    // device ingested the message itself, `sourceId` is the local SMS provider
    // row id (SmsIngestPipeline sets it to `messageId.toString()`), which lets
    // the real sender be recovered from the on-device inbox -- the same data
    // MessagesScreen/MessageDetailScreen already show, just not previously
    // looked up here. Falls back to the empty placeholder (Block still
    // correctly refuses with an explanation) when there's no local row to
    // resolve, e.g. a different device on the same account.
    private val _resolvedSender = MutableStateFlow("")
    val resolvedSender: StateFlow<String> = _resolvedSender.asStateFlow()

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
            _resolvedSender.value = ""

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
                .onSuccess { alerts ->
                    val found = alerts.find { it.messageId == messageId }
                    _alert.value = found
                    _resolvedSender.value = resolveSender(found?.sourceId)
                }.onFailure { error -> _errorMessage.value = error.toUserMessage("Could not reach the server") }

            _isLoading.value = false
        }
    }

    private suspend fun resolveSender(sourceId: String?): String {
        val localId = sourceId?.toLongOrNull() ?: return ""
        return withContext(Dispatchers.IO) {
            smsRepository.getMessageById(localId)?.sender.orEmpty()
        }
    }
}
