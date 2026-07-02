package com.bantai.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.util.BlockHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class BlockedNumbersViewModel(application: Application) : AndroidViewModel(application) {

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
            _blockedNumbers.value = BlockHelper.getBlockedNumbers(getApplication())
            _isLoading.value = false
        }
    }

    fun unblockNumber(entry: BlockHelper.BlockedEntry) {
        viewModelScope.launch(Dispatchers.IO) {
            BlockHelper.unblockNumberSystem(getApplication(), entry.number)
            loadBlockedNumbers()
        }
    }
}
