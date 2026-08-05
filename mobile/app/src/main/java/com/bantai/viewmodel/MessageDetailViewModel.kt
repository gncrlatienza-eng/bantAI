package com.bantai.viewmodel

import android.app.Application
import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.Telephony
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.data.SmsRepository
import com.bantai.data.local.DeletedMessagesStore
import com.bantai.data.local.DraftsStore
import com.bantai.data.model.SmsMessage
import com.bantai.data.model.normalizeSenderKey
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class MessageDetailViewModel(application: Application) : AndroidViewModel(application) {

    private val smsRepository = SmsRepository(application)
    private val deletedMessagesStore = DeletedMessagesStore(application)
    private val draftsStore = DraftsStore(application)

    private val _conversation = MutableStateFlow<List<SmsMessage>>(emptyList())
    val conversation: StateFlow<List<SmsMessage>> = _conversation.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    // Any unsent reply text left in this thread's reply bar from a previous visit.
    private val _draftBody = MutableStateFlow("")
    val draftBody: StateFlow<String> = _draftBody.asStateFlow()

    // Selection mode for deleting individual messages within this thread — unlike
    // MessagesViewModel's selection (which expands a row to a whole conversation),
    // here a selected id is deleted exactly as-is, leaving the rest of the thread intact.
    private val _selectionMode = MutableStateFlow(false)
    val selectionMode: StateFlow<Boolean> = _selectionMode.asStateFlow()

    private val _selectedIds = MutableStateFlow<Set<Long>>(emptySet())
    val selectedIds: StateFlow<Set<Long>> = _selectedIds.asStateFlow()

    private var currentSender: String? = null

    // The SMS provider gives no push signal on its own — without this, a thread
    // left open would never show a message that arrives while you're looking at it.
    private val contentObserver = object : ContentObserver(Handler(Looper.getMainLooper())) {
        override fun onChange(selfChange: Boolean) {
            currentSender?.let { loadConversation(it) }
        }
    }

    init {
        getApplication<Application>().contentResolver.registerContentObserver(
            Telephony.Sms.CONTENT_URI, true, contentObserver,
        )
    }

    fun loadConversation(sender: String) {
        currentSender = sender
        viewModelScope.launch(Dispatchers.IO) {
            _isLoading.value = true
            val deletedIds = deletedMessagesStore.deletedEntries.first().map { it.id }.toSet()
            _conversation.value = smsRepository.getConversationBySender(sender)
                .filterNot { it.id in deletedIds }
            val senderKey = normalizeSenderKey(sender)
            _draftBody.value = draftsStore.drafts.first()
                .firstOrNull { normalizeSenderKey(it.address) == senderKey }
                ?.body ?: ""
            _isLoading.value = false
        }
    }

    // Called once per screen visit (not from the ContentObserver's reload path,
    // which would re-trigger on this update and risk a refresh loop).
    fun markAsRead(sender: String) {
        viewModelScope.launch(Dispatchers.IO) {
            smsRepository.markConversationRead(sender)
        }
    }

    /** Called from the reply bar's onDispose — preserves unsent text as a draft. */
    fun saveDraft(body: String) {
        val sender = currentSender ?: return
        viewModelScope.launch(Dispatchers.IO) {
            draftsStore.saveDraft(sender, body)
        }
    }

    fun clearDraft() {
        val sender = currentSender ?: return
        viewModelScope.launch(Dispatchers.IO) {
            draftsStore.deleteDraft(sender)
        }
    }

    override fun onCleared() {
        super.onCleared()
        getApplication<Application>().contentResolver.unregisterContentObserver(contentObserver)
    }

    // --- Selection mode -----------------------------------------------------

    fun enterSelectionMode(id: Long) {
        _selectionMode.value = true
        _selectedIds.value = setOf(id)
    }

    fun toggleSelected(id: Long) {
        _selectedIds.value = if (id in _selectedIds.value) {
            _selectedIds.value - id
        } else {
            _selectedIds.value + id
        }
    }

    fun selectAll() {
        _selectedIds.value = _conversation.value.map { it.id }.toSet()
    }

    fun exitSelectionMode() {
        _selectionMode.value = false
        _selectedIds.value = emptySet()
    }

    /** Soft-deletes exactly the selected messages — they move to Recently Deleted. */
    fun deleteSelected() {
        val ids = _selectedIds.value
        if (ids.isEmpty()) return
        viewModelScope.launch(Dispatchers.IO) {
            deletedMessagesStore.markDeleted(ids)
            exitSelectionMode()
            currentSender?.let { loadConversation(it) }
        }
    }
}
