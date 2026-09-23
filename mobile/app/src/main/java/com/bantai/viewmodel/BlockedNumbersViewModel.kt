package com.bantai.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.data.local.UserPreferences
import com.bantai.data.remote.BlockedNumbersApi
import com.bantai.data.remote.toUserMessage
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

    // Surfaced when a backend unblock call fails -- the device-level unblock
    // (BlockHelper.unblockNumberSystem) still succeeds either way, but the
    // backend row would otherwise keep silently suppressing that sender's
    // messages forever with nothing telling the user their unblock didn't
    // fully take effect.
    private val _syncError = MutableStateFlow<String?>(null)
    val syncError: StateFlow<String?> = _syncError.asStateFlow()

    init {
        loadBlockedNumbers()
    }

    // Android's BlockedNumberContract (read here) is the single source of truth
    // for this screen's list -- purely local, no backend round trip needed just
    // to display it. This used to also call reconcileWithBackend() on every
    // load (including right after this screen opens), which re-POSTed every
    // number in the system block list to the backend every single time,
    // including numbers the user blocked through the system Phone/Messages app
    // and never asked BantAI to track at all. Blocking through BantAI (Take
    // Action, this screen) already mirrors to the backend itself at the point
    // of blocking -- see TakeActionScreen.blockIfSelected -- so no separate
    // reconciliation pass is needed.
    fun loadBlockedNumbers() {
        viewModelScope.launch(Dispatchers.IO) {
            _isLoading.value = true
            _blockedNumbers.value = BlockHelper.getBlockedNumbers(getApplication())
            _isLoading.value = false
        }
    }

    fun unblockNumber(entry: BlockHelper.BlockedEntry) {
        viewModelScope.launch(Dispatchers.IO) {
            val context = getApplication<Application>()
            BlockHelper.unblockNumberSystem(context, entry.number)
            val token = userPreferences.userData.first().authToken
            if (token.isNotEmpty()) {
                BlockedNumbersApi
                    .unblock(token, entry.number)
                    .onFailure { error ->
                        _syncError.value =
                            error.toUserMessage(
                                "Unblocked on this device, but couldn't sync to the server -- " +
                                    "this number may still be silently suppressed.",
                            )
                    }
            }
            loadBlockedNumbers()
        }
    }

    fun clearSyncError() {
        _syncError.value = null
    }
}
