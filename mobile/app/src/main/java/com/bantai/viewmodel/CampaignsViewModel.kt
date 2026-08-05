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

class CampaignsViewModel(application: Application) : AndroidViewModel(application) {

    private val userPreferences = UserPreferences(application)

    private val _activeCampaigns = MutableStateFlow<List<CampaignsApi.CampaignSummary>>(emptyList())
    val activeCampaigns: StateFlow<List<CampaignsApi.CampaignSummary>> = _activeCampaigns.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    init {
        loadCampaigns()
    }

    fun loadCampaigns() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null

            val token = userPreferences.userData.first().authToken
            if (token.isEmpty()) {
                _isLoading.value = false
                _errorMessage.value = "Sign in to see campaigns"
                return@launch
            }

            CampaignsApi.list(token)
                .onSuccess { campaigns -> _activeCampaigns.value = campaigns }
                .onFailure { error -> _errorMessage.value = error.message ?: "Could not reach the server" }
            _isLoading.value = false
        }
    }
}
