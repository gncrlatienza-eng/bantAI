package com.bantai.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.data.local.UserPreferences
import com.bantai.data.remote.CampaignsApi
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class CampaignsViewModel(
    application: Application,
) : AndroidViewModel(application) {
    private val userPreferences = UserPreferences(application)

    private val _activeCampaigns = MutableStateFlow<List<CampaignsApi.CampaignSummary>>(emptyList())
    val activeCampaigns: StateFlow<List<CampaignsApi.CampaignSummary>> = _activeCampaigns.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private val _inactiveCampaigns = MutableStateFlow<List<CampaignsApi.CampaignSummary>>(emptyList())
    val inactiveCampaigns: StateFlow<List<CampaignsApi.CampaignSummary>> = _inactiveCampaigns.asStateFlow()

    private val _isLoadingInactive = MutableStateFlow(true)
    val isLoadingInactive: StateFlow<Boolean> = _isLoadingInactive.asStateFlow()

    private val _inactiveErrorMessage = MutableStateFlow<String?>(null)
    val inactiveErrorMessage: StateFlow<String?> = _inactiveErrorMessage.asStateFlow()

    init {
        loadCampaigns()
    }

    fun loadCampaigns() {
        viewModelScope.launch {
            _isLoading.value = true
            _isLoadingInactive.value = true
            _errorMessage.value = null
            _inactiveErrorMessage.value = null

            val token = userPreferences.userData.first().authToken
            if (token.isEmpty()) {
                _isLoading.value = false
                _isLoadingInactive.value = false
                _errorMessage.value = "Sign in to see campaigns"
                _inactiveErrorMessage.value = "Sign in to see campaigns"
                return@launch
            }

            coroutineScope {
                launch {
                    CampaignsApi
                        .list(token)
                        .onSuccess { _activeCampaigns.value = it }
                        .onFailure { _errorMessage.value = it.message ?: "Could not reach the server" }
                    _isLoading.value = false
                }
                launch {
                    CampaignsApi
                        .listInactive(token)
                        .onSuccess { _inactiveCampaigns.value = it }
                        .onFailure { _inactiveErrorMessage.value = it.message ?: "Could not reach the server" }
                    _isLoadingInactive.value = false
                }
            }
        }
    }
}
