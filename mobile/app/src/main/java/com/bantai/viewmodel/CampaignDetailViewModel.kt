package com.bantai.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.data.local.UserPreferences
import com.bantai.data.remote.CampaignsApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class CampaignDetailViewModel(application: Application) : AndroidViewModel(application) {

    private val userPreferences = UserPreferences(application)

    private val _campaign = MutableStateFlow<CampaignsApi.CampaignDetail?>(null)
    val campaign: StateFlow<CampaignsApi.CampaignDetail?> = _campaign.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    fun loadCampaign(id: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null

            val token = userPreferences.userData.first().authToken
            if (token.isEmpty()) {
                _isLoading.value = false
                _errorMessage.value = "Sign in to see this campaign"
                return@launch
            }

            CampaignsApi.getById(token, id)
                .onSuccess { detail -> _campaign.value = detail }
                .onFailure { error -> _errorMessage.value = error.message ?: "Could not reach the server" }
            _isLoading.value = false
        }
    }
}
