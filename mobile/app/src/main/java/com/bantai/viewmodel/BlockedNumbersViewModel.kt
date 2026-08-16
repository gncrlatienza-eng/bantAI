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

class BlockedNumbersViewModel(application: Application) : AndroidViewModel(application) {

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

    // The backend already records an entry itself when /sms/ingest auto-blocks
    // a sender — this only has to cover the two directions that don't already
    // happen server-side: a backend-known block this device hasn't applied yet
    // (e.g. a fresh install, or a block made from another device), and a
    // device-side block (from the offline local-heuristic fallback path, which
    // never calls the backend at all) the backend doesn't know about yet.
    // Best-effort both ways — a sync failure here must never block the screen
    // from showing whatever the device already has.
    private suspend fun reconcileWithBackend(context: Context, token: String) {
        val backendEntries = BlockedNumbersApi.list(token).getOrNull() ?: return
        val deviceNumbers = BlockHelper.getBlockedNumbers(context).map { it.number }.toSet()

        for (entry in backendEntries) {
            if (entry.sender !in deviceNumbers) {
                BlockHelper.blockNumberSystem(context, entry.sender)
            }
        }

        val backendSenders = backendEntries.map { it.sender }.toSet()
        for (number in deviceNumbers) {
            if (number !in backendSenders) {
                BlockedNumbersApi.block(token, number)
            }
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
