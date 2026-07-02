package com.bantai.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.data.SmsRepository
import com.bantai.data.local.UserPreferences
import com.bantai.data.model.SmsMessage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class MessagesViewModel(application: Application) : AndroidViewModel(application) {

    private val smsRepository = SmsRepository(application)
    private val userPreferences = UserPreferences(application)

    private val _allMessages = MutableStateFlow<List<SmsMessage>>(emptyList())

    private val _inboxMessages = MutableStateFlow<List<SmsMessage>>(emptyList())
    val inboxMessages: StateFlow<List<SmsMessage>> = _inboxMessages.asStateFlow()

    private val _suspiciousMessages = MutableStateFlow<List<SmsMessage>>(emptyList())
    val suspiciousMessages: StateFlow<List<SmsMessage>> = _suspiciousMessages.asStateFlow()

    private val _unknownMessages = MutableStateFlow<List<SmsMessage>>(emptyList())
    val unknownMessages: StateFlow<List<SmsMessage>> = _unknownMessages.asStateFlow()

    private val _suspiciousTodayCount = MutableStateFlow(0)
    val suspiciousTodayCount: StateFlow<Int> = _suspiciousTodayCount.asStateFlow()

    private val _unknownTodayCount = MutableStateFlow(0)
    val unknownTodayCount: StateFlow<Int> = _unknownTodayCount.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _hasPermission = MutableStateFlow(smsRepository.hasReadSmsPermission())
    val hasPermission: StateFlow<Boolean> = _hasPermission.asStateFlow()

    private var _scanPeriod = "daily"

    init {
        loadMessages()
        viewModelScope.launch {
            userPreferences.userData.collect { data ->
                if (_scanPeriod != data.scanPeriod) {
                    _scanPeriod = data.scanPeriod
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
            _allMessages.value = smsRepository.getInboxMessagesByPeriod(_scanPeriod)
            filterMessages(_searchQuery.value)
            _isLoading.value = false
        }
    }

    fun updateSearchQuery(query: String) {
        _searchQuery.value = query
        filterMessages(query)
    }

    private fun isToday(timestamp: Long): Boolean {
        val cal = java.util.Calendar.getInstance()
        val todayStart = cal.apply {
            set(java.util.Calendar.HOUR_OF_DAY, 0)
            set(java.util.Calendar.MINUTE, 0)
            set(java.util.Calendar.SECOND, 0)
            set(java.util.Calendar.MILLISECOND, 0)
        }.timeInMillis
        return timestamp >= todayStart
    }

    private fun filterMessages(query: String) {
        val all = _allMessages.value
        val filtered = if (query.isEmpty()) all
        else all.filter {
            it.sender.contains(query, ignoreCase = true) ||
                it.body.contains(query, ignoreCase = true)
        }

        _inboxMessages.value = filtered

        val suspicious = filtered.filter { it.classification == "suspicious" }
        _suspiciousMessages.value = suspicious
        _suspiciousTodayCount.value = suspicious.count { isToday(it.timestamp) }

        val unknown = filtered.filter { it.classification == "unknown" }
        _unknownMessages.value = unknown
        _unknownTodayCount.value = unknown.count { isToday(it.timestamp) }
    }
}
