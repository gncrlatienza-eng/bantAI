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

class ScamAwarenessViewModel(application: Application) : AndroidViewModel(application) {

    private val userPreferences = UserPreferences(application)

    private val _relevantTipIds = MutableStateFlow<Set<String>>(emptySet())
    val relevantTipIds: StateFlow<Set<String>> = _relevantTipIds.asStateFlow()

    init {
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
            val label = alert.label?.lowercase() ?: ""
            val bucket = alert.bucket?.lowercase() ?: ""
            if (label.contains("scam") || bucket == "blocked") {
                tips += setOf("gcash", "otp", "links")
            }
            if (label.contains("spam") || alert.status == "Pending") {
                tips += setOf("urgency", "links")
            }
        }
        if (tips.isNotEmpty()) tips += "action"
        return tips
    }
}
