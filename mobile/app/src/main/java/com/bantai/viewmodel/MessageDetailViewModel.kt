package com.bantai.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.data.SmsRepository
import com.bantai.data.model.SmsMessage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class MessageDetailViewModel(application: Application) : AndroidViewModel(application) {

    private val smsRepository = SmsRepository(application)

    private val _conversation = MutableStateFlow<List<SmsMessage>>(emptyList())
    val conversation: StateFlow<List<SmsMessage>> = _conversation.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    fun loadConversation(sender: String) {
        viewModelScope.launch(Dispatchers.IO) {
            _isLoading.value = true
            _conversation.value = smsRepository.getConversationBySender(sender)
            _isLoading.value = false
        }
    }
}
