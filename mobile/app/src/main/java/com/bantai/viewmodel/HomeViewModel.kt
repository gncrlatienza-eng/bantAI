package com.bantai.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.data.SmsRepository
import com.bantai.data.local.UserData
import com.bantai.data.local.UserPreferences
import com.bantai.data.model.SmsMessage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class HomeViewModel(application: Application) : AndroidViewModel(application) {

    private val smsRepository = SmsRepository(application)
    private val userPreferences = UserPreferences(application)

    private val _userData = MutableStateFlow(UserData())
    val userData: StateFlow<UserData> = _userData.asStateFlow()

    private val _recentMessages = MutableStateFlow<List<SmsMessage>>(emptyList())
    val recentMessages: StateFlow<List<SmsMessage>> = _recentMessages.asStateFlow()

    private val _scannedCount = MutableStateFlow(0)
    val scannedCount: StateFlow<Int> = _scannedCount.asStateFlow()

    private val _smishingCount = MutableStateFlow(0)
    val smishingCount: StateFlow<Int> = _smishingCount.asStateFlow()

    private val _suspiciousCount = MutableStateFlow(0)
    val suspiciousCount: StateFlow<Int> = _suspiciousCount.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _hasPermission = MutableStateFlow(smsRepository.hasReadSmsPermission())
    val hasPermission: StateFlow<Boolean> = _hasPermission.asStateFlow()

    private val _scanPeriod = MutableStateFlow("daily")
    val scanPeriod: StateFlow<String> = _scanPeriod.asStateFlow()

    init {
        loadUserData()
        loadMessages()
    }

    private fun loadUserData() {
        viewModelScope.launch {
            userPreferences.userData.collect { data ->
                _userData.value = data
                if (_scanPeriod.value != data.scanPeriod) {
                    _scanPeriod.value = data.scanPeriod
                    loadMessages()
                }
            }
        }
    }

    fun onPermissionGranted() {
        _hasPermission.value = true
        loadMessages()
    }

    fun loadMessages() {
        viewModelScope.launch(Dispatchers.IO) {
            _isLoading.value = true

            // 1. Recent messages for inbox preview — always ALL messages, no period filter
            val allMessages = smsRepository.getInboxMessages(limit = 50)
            _recentMessages.value = allMessages.take(6)

            // 2. Stats — filtered by scan period
            val periodMessages = smsRepository.getInboxMessagesByPeriod(_scanPeriod.value)
            _scannedCount.value = periodMessages.size
            _smishingCount.value = periodMessages.count { it.classification == "suspicious" }
            _suspiciousCount.value = periodMessages.count { it.classification == "unknown" }

            _isLoading.value = false
        }
    }

    fun getPeriodLabel(): String = when (_scanPeriod.value) {
        "weekly" -> "This week"
        "monthly" -> "This month"
        else -> "Today"
    }

    fun getInitials(): String {
        val first = _userData.value.firstName.firstOrNull()?.uppercase() ?: ""
        val last = _userData.value.lastName.firstOrNull()?.uppercase() ?: ""
        return "$first$last".ifEmpty { "?" }
    }

    fun getGreeting(): String {
        val hour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
        return when {
            hour < 12 -> "Good morning,"
            hour < 18 -> "Good afternoon,"
            else -> "Good evening,"
        }
    }
}
