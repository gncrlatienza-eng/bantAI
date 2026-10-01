package com.bantai.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.container
import com.bantai.util.BlockHelper
import com.bantai.util.ContactNames
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class BlockedNumbersViewModel(
    application: Application,
) : AndroidViewModel(application) {
    private val userPreferences = application.container.userPreferences
    private val blockedSendersStore = application.container.blockedSendersStore

    private val _blockedNumbers = MutableStateFlow<List<BlockHelper.BlockedEntry>>(emptyList())
    val blockedNumbers: StateFlow<List<BlockHelper.BlockedEntry>> = _blockedNumbers.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    // Whether BantAI can write Android's block list at all -- when it can't,
    // server-only blocks can't be moved onto the phone yet.
    private val _isDefaultSmsApp = MutableStateFlow(true)
    val isDefaultSmsApp: StateFlow<Boolean> = _isDefaultSmsApp.asStateFlow()

    // Surfaced when a backend unblock call fails -- the device-level unblock
    // still succeeds either way, but the backend row would otherwise keep
    // silently suppressing that sender's messages forever with nothing telling
    // the user their unblock didn't fully take effect.
    private val _syncError = MutableStateFlow<String?>(null)
    val syncError: StateFlow<String?> = _syncError.asStateFlow()

    init {
        loadBlockedNumbers()
    }

    // Android's block list plus every sender BantAI blocked (BlockedSendersStore).
    // The second half matters when BantAI wasn't the default SMS app at the
    // time: Android refused the device block, so only the server has it, and
    // the backend can't list it back (it keeps only a fingerprint of the
    // sender). Before this, those blocks were counted in Alerts but missing here.
    fun loadBlockedNumbers() {
        viewModelScope.launch(Dispatchers.IO) {
            _isLoading.value = true
            val context = getApplication<Application>()
            _isDefaultSmsApp.value = BlockHelper.isDefaultSmsApp(context)
            val onDevice = BlockHelper.getBlockedNumbers(context)
            val deviceNumbers = onDevice.map { it.number }.toSet()
            val serverOnly =
                blockedSendersStore
                    .current()
                    .blocked
                    .filter { it !in deviceNumbers && !BlockHelper.isBlocked(context, it) }
                    .sorted()
                    .mapIndexed { index, sender ->
                        // Negative ids can't collide with BlockedNumberContract's row ids.
                        BlockHelper.BlockedEntry(id = -(index + 1L), number = sender, onDevice = false)
                    }
            // Contact names, so "gio" isn't just an unfamiliar 09765548004 in the list.
            _blockedNumbers.value =
                (onDevice + serverOnly).map { entry ->
                    entry.copy(name = runCatching { ContactNames.lookup(context, entry.number) }.getOrNull())
                }
            _isLoading.value = false
        }
    }

    fun unblockNumber(entry: BlockHelper.BlockedEntry) {
        viewModelScope.launch {
            val context = getApplication<Application>()
            val token = userPreferences.userData.first().authToken
            val synced = BlockHelper.unblockSender(context, token, entry.number)
            if (!synced) {
                _syncError.value =
                    "Unblocked on this phone, but couldn't reach BantAI's server — " +
                    "this sender may still be filtered. Try again when you're online."
            }
            loadBlockedNumbers()
        }
    }

    // Moves server-only blocks onto the phone once BantAI is the default SMS app.
    fun blockOnDevice() {
        viewModelScope.launch {
            val context = getApplication<Application>()
            val token = userPreferences.userData.first().authToken
            _blockedNumbers.value
                .filter { !it.onDevice }
                .forEach { BlockHelper.blockSender(context, token, it.number) }
            loadBlockedNumbers()
        }
    }

    fun clearSyncError() {
        _syncError.value = null
    }
}
