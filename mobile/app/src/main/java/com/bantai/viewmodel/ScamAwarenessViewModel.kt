package com.bantai.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.container
import com.bantai.data.PublishedTips
import com.bantai.data.remote.SmsApi
import com.bantai.data.remote.TipsApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class ScamAwarenessViewModel(
    application: Application,
) : AndroidViewModel(application) {
    private val userPreferences = application.container.userPreferences

    private val _relevantTipIds = MutableStateFlow<Set<String>>(emptySet())
    val relevantTipIds: StateFlow<Set<String>> = _relevantTipIds.asStateFlow()

    // Tips the team published from the admin dashboard (general ones only;
    // campaign tips show on that Scam Wave). Empty offline: the built-in
    // tips below still show.
    private val _latestTips = MutableStateFlow<List<TipsApi.PublishedTip>>(emptyList())
    val latestTips: StateFlow<List<TipsApi.PublishedTip>> = _latestTips.asStateFlow()

    init {
        viewModelScope.launch { _latestTips.value = PublishedTips.general(PublishedTips.load()) }
        viewModelScope.launch {
            val token = userPreferences.userData.first().authToken
            if (token.isEmpty()) return@launch
            SmsApi.getAlerts(token).onSuccess { alerts ->
                _relevantTipIds.value = deriveRelevantTips(alerts)
            }
        }
    }

    private fun deriveRelevantTips(alerts: List<SmsApi.AlertSummary>): Set<String> {
        val tips = mutableSetOf<String>()
        for (alert in alerts) {
            // SmsApi.parseAlert has already mapped the backend's Scam/Spam to
            // the display terms "Likely Smishing"/"Suspicious", so matching on
            // "scam"/"spam" here never fired.
            val label = alert.label?.lowercase() ?: ""
            val bucket = alert.bucket?.lowercase() ?: ""
            if (label.contains("smishing") || label.contains("scam") || bucket == "blocked") {
                tips += setOf("gcash", "otp", "links")
            }
            if (label.contains("suspicious") || label.contains("spam") || alert.status == "Pending") {
                tips += setOf("urgency", "links")
            }
        }
        if (tips.isNotEmpty()) tips += "action"
        return tips
    }
}
