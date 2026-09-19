package com.bantai.viewmodel

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.data.local.UserPreferences
import com.bantai.data.remote.BlockedNumbersApi
import com.bantai.util.BlockHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class BlockedNumbersViewModel(
    application: Application,
) : AndroidViewModel(application) {
    private val userPreferences = UserPreferences(application)

    private val _blockedNumbers = MutableStateFlow<List<BlockHelper.BlockedEntry>>(emptyList())
    val blockedNumbers: StateFlow<List<BlockHelper.BlockedEntry>> = _blockedNumbers.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    init {
        loadBlockedNumbers()
    }

    fun loadBlockedNumbers() {
        viewModelScope.launch(Dispatchers.IO) {
            _isLoading.value = true
            val context = getApplication<Application>()
            val token = userPreferences.userData.first().authToken
            if (token.isNotEmpty()) {
                reconcileWithBackend(context, token)
            }
            _blockedNumbers.value = BlockHelper.getBlockedNumbers(context)
            _isLoading.value = false
        }
    }

    // Android's blocked-number store is the source of actionable sender values.
    // Backend rows use non-reversible enforcement pseudonyms and cannot safely
    // be rendered or applied as phone numbers on another device.
    private suspend fun reconcileWithBackend(
        context: Context,
        token: String,
    ) {
        BlockedNumbersApi.list(token).getOrNull() ?: return
        val deviceNumbers = BlockHelper.getBlockedNumbers(context).map { it.number }.toSet()
        for (number in deviceNumbers) {
            BlockedNumbersApi.block(token, number)
        }
    }

    fun unblockNumber(entry: BlockHelper.BlockedEntry) {
        viewModelScope.launch(Dispatchers.IO) {
            val context = getApplication<Application>()
            BlockHelper.unblockNumberSystem(context, entry.number)
            val token = userPreferences.userData.first().authToken
            if (token.isNotEmpty()) {
                BlockedNumbersApi.unblock(token, entry.number)
            }
            loadBlockedNumbers()
        }
    }
}
