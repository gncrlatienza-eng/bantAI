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

class SmishingAlertViewModel(application: Application) : AndroidViewModel(application) {

    private val userPreferences = UserPreferences(application)

    private val _indicators = MutableStateFlow<List<SmsApi.Indicator>>(emptyList())
    val indicators: StateFlow<List<SmsApi.Indicator>> = _indicators.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    fun loadIndicators(messageId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            val token = userPreferences.userData.first().authToken
            if (token.isNotEmpty()) {
                SmsApi.getIndicators(token, messageId)
                    .onSuccess { _indicators.value = it }
            }
            _isLoading.value = false
        }
    }
}
