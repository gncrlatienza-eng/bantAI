package com.bantai.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.container
import com.bantai.data.AlertBlocking
import com.bantai.data.remote.CampaignsApi
import com.bantai.data.remote.SmsApi
import com.bantai.data.remote.VerificationApi
import com.bantai.data.remote.toUserMessage
import com.bantai.data.withLocalContent
import com.bantai.util.TrustedSenders
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
    private val userPreferences = application.container.userPreferences
    private val smsRepository = application.container.smsRepository

    private val _alert = MutableStateFlow<SmsApi.AlertSummary?>(null)
    val alert: StateFlow<SmsApi.AlertSummary?> = _alert.asStateFlow()

    private val _indicators = MutableStateFlow<List<SmsApi.IndicatorTag>>(emptyList())
    val indicators: StateFlow<List<SmsApi.IndicatorTag>> = _indicators.asStateFlow()

    // Separate from isLoading (which gates the whole screen's skeleton) so the
    // alert itself, sender, and message body can render immediately while
    // indicators -- a second, independent network call -- are still coming in.
    // Previously nothing ever called SmsApi.getIndicators at all, so
    // `indicators` stayed permanently empty and the alert screen always showed
    // "Still computing..." no matter how long you waited.
    private val _indicatorsLoading = MutableStateFlow(false)
    val indicatorsLoading: StateFlow<Boolean> = _indicatorsLoading.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    // The backend never sends a real sender (AlertSummary.sender is always "" --
    // see SmsApi.parseAlert's privacy placeholder), so Block from this screen
    // always failed with "Can't block — no number for this message." When this
    // device ingested the message itself, `sourceId` resolves to the local SMS
    // provider row id (see SmsSourceId), which lets
    // the real sender be recovered from the on-device inbox -- the same data
    // MessagesScreen/MessageDetailScreen already show, just not previously
    // looked up here. Falls back to the empty placeholder (Block still
    // correctly refuses with an explanation) when there's no local row to
    // resolve, e.g. a different device on the same account.
    private val _resolvedSender = MutableStateFlow("")
    val resolvedSender: StateFlow<String> = _resolvedSender.asStateFlow()

    // Scams block their sender automatically, so the alert is a learning record
    // with nothing to act on -- except for trusted senders (telcos, registry
    // organisations), which are never auto-blocked and keep Block/Report.
    // How many texts the alert's scam wave (campaign) has, for the "sent N
    // times" line; null when it isn't in one or the count couldn't be read.
    private val _waveSize = MutableStateFlow<Int?>(null)
    val waveSize: StateFlow<Int?> = _waveSize.asStateFlow()

    private val _isTrustedSender = MutableStateFlow(false)
    val isTrustedSender: StateFlow<Boolean> = _isTrustedSender.asStateFlow()

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
            _isTrustedSender.value = false
            _indicators.value = emptyList()

            val token = userPreferences.userData.first().authToken
            if (token.isEmpty()) {
                _isLoading.value = false
                _errorMessage.value = "Sign in to see this alert"
                return@launch
            }

            // GET /sms/:messageId/alert -- just this alert, so one older than the
            // newest page of the list still opens.
            SmsApi
                .getAlertForMessage(token, messageId)
                .onSuccess { fetched ->
                    val found =
                        fetched?.let { alert ->
                            val local = withContext(Dispatchers.IO) { smsRepository.withLocalContent(listOf(alert)) }
                            AlertBlocking.withBlockStatus(getApplication(), token, local, catchUp = false).first()
                        }
                    _alert.value = found
                    _resolvedSender.value = found?.sender.orEmpty()
                }.onFailure { error -> _errorMessage.value = error.toUserMessage("Could not reach the server") }

            _isLoading.value = false

            _waveSize.value = null
            if (_alert.value != null) {
                resolveTrust(token, _resolvedSender.value)
                _alert.value?.clusterId?.let { clusterId ->
                    _waveSize.value =
                        CampaignsApi
                            .getById(token, clusterId)
                            .getOrNull()
                            ?.messageCount
                            ?.takeIf { it > 1 }
                }
                loadIndicators(token, messageId)
            }
        }
    }

    private suspend fun resolveTrust(
        token: String,
        sender: String,
    ) {
        if (sender.isEmpty()) return
        if (TrustedSenders.isBuiltIn(sender)) {
            _isTrustedSender.value = true
            return
        }
        val registry = VerificationApi.verifySender(token, sender).getOrNull()?.familiarity
        _isTrustedSender.value = TrustedSenders.isTrusted(sender, registry)
    }

    private suspend fun loadIndicators(
        token: String,
        messageId: String,
    ) {
        _indicatorsLoading.value = true
        // A failure here (network blip, indicators genuinely not computed yet)
        // leaves the list empty rather than surfacing a second error banner --
        // the rest of the alert (sender, body, score) is already showing, and
        // the empty-indicators state already reads as "none recorded".
        SmsApi.getIndicators(token, messageId).onSuccess { _indicators.value = it }
        _indicatorsLoading.value = false
    }
}
