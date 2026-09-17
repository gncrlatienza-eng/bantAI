package com.bantai.viewmodel

import android.app.Application
import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.Telephony
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.data.SmsRepository
import com.bantai.data.local.DeletedMessagesStore
import com.bantai.data.local.DraftsStore
import com.bantai.data.local.UserPreferences
import com.bantai.data.model.SmsMessage
import com.bantai.data.model.groupedBySenderLatest
import com.bantai.data.model.normalizeSenderKey
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

private const val TAG = "MessagesViewModel"

enum class MessageFilter(
    val label: String,
) {
    MESSAGES("Messages"),
    SPAM("Spam"),
    UNKNOWN("Unknown"),
    RECENTLY_DELETED("Recently Deleted"),
    UNREAD("Unread"),
    DRAFTS("Drafts"),
}

class MessagesViewModel(
    application: Application,
) : AndroidViewModel(application) {
    private val smsRepository = SmsRepository(application)
    private val userPreferences = UserPreferences(application)
    private val deletedMessagesStore = DeletedMessagesStore(application)
    private val draftsStore = DraftsStore(application)

    private val allMessages = MutableStateFlow<List<SmsMessage>>(emptyList())

    // All currently soft-deleted messages, flat/ungrouped — the source of truth
    // used both to build the grouped Recently Deleted view and, in
    // restoreSelected()/permanentlyDeleteSelected(), to resolve a selected
    // conversation row back out to every deleted id for that sender.
    private val recentlyDeleted = MutableStateFlow<List<SmsMessage>>(emptyList())

    // Synthesized from DraftsStore (drafts have no real SMS provider row, so no
    // real id) — id is a stable hash of the recipient address, which is safe since
    // drafts and real messages are never shown in the same filter's visible list.
    private val draftRows = MutableStateFlow<List<SmsMessage>>(emptyList())

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

    private val _selectedFilter = MutableStateFlow(MessageFilter.MESSAGES)
    val selectedFilter: StateFlow<MessageFilter> = _selectedFilter.asStateFlow()

    private val _visibleMessages = MutableStateFlow<List<SmsMessage>>(emptyList())
    val visibleMessages: StateFlow<List<SmsMessage>> = _visibleMessages.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private var loadJob: Job? = null

    private val _hasPermission = MutableStateFlow(smsRepository.hasReadSmsPermission())
    val hasPermission: StateFlow<Boolean> = _hasPermission.asStateFlow()

    // Selection mode — rows are keyed by whatever SmsMessage.id is showing in
    // visibleMessages. In every filter except Recently Deleted, that id is just
    // the latest message of a grouped conversation; deleteSelected() expands
    // each selected row back out to every message id in that sender's thread.
    private val _selectionMode = MutableStateFlow(false)
    val selectionMode: StateFlow<Boolean> = _selectionMode.asStateFlow()

    private val _selectedIds = MutableStateFlow<Set<Long>>(emptySet())
    val selectedIds: StateFlow<Set<Long>> = _selectedIds.asStateFlow()

    private var scanPeriod = "daily"

    companion object {
        // Real SMS provider row ids are always positive autoincrement values, so
        // forcing this negative guarantees a draft id can never collide with a
        // real message's id, not just with another draft's. A 64-bit FNV-1a hash
        // (rather than String.hashCode()'s 32 bits) also makes a collision
        // between two different drafts astronomically less likely.
        private const val FNV_OFFSET_BASIS = -3750763034362895579L
        private const val FNV_PRIME = 1099511628211L

        private fun stableDraftId(key: String): Long {
            var hash = FNV_OFFSET_BASIS
            for (c in key) {
                hash = hash xor c.code.toLong()
                hash *= FNV_PRIME
            }
            return -(hash and Long.MAX_VALUE) - 1
        }
    }

    // The SMS provider gives no push signal on its own — without this, the thread
    // list would only pick up a new message after leaving and re-entering the screen.
    private val contentObserver =
        object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) {
                loadMessages()
            }
        }

    init {
        loadMessages()
        viewModelScope.launch {
            userPreferences.userData.collect { data ->
                if (scanPeriod != data.scanPeriod) {
                    scanPeriod = data.scanPeriod
                    loadMessages()
                }
            }
        }
        application.contentResolver.registerContentObserver(
            Telephony.Sms.CONTENT_URI,
            true,
            contentObserver,
        )
        // DataStore's Flow already emits on every write, so this stays live without
        // needing a ContentObserver-style poke — a saved/cleared draft shows up
        // immediately rather than waiting for the next unrelated SMS-provider change.
        viewModelScope.launch {
            draftsStore.drafts.collect { entries ->
                draftRows.value =
                    entries.sortedByDescending { it.updatedAt }.map { entry ->
                        SmsMessage(
                            id = stableDraftId(normalizeSenderKey(entry.address)),
                            sender = entry.address,
                            body = entry.body,
                            timestamp = entry.updatedAt,
                            classification = "safe",
                            isRead = true,
                        )
                    }
                filterMessages(_searchQuery.value)
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        getApplication<Application>().contentResolver.unregisterContentObserver(contentObserver)
    }

    fun onPermissionGranted() {
        _hasPermission.value = true
        loadMessages()
    }

    fun loadMessages() {
        // Cancels any in-flight load before starting a new one — loadMessages() fires
        // concurrently from init, the content observer, scan-period changes, and the
        // permission callback, so a burst of incoming SMS can otherwise race several
        // overlapping loads writing these StateFlows out of order.
        loadJob?.cancel()
        loadJob =
            viewModelScope.launch(Dispatchers.IO) {
                _isLoading.value = true
                _errorMessage.value = null
                try {
                    val deletedIds =
                        deletedMessagesStore.deletedEntries
                            .first()
                            .map { it.id }
                            .toSet()
                    // The inbox always shows the full message history like a normal SMS
                    // app; the scan period setting only governs scanning/stat windows.
                    allMessages.value =
                        smsRepository
                            .getInboxMessages(limit = 500)
                            .filterNot { it.id in deletedIds }
                    recentlyDeleted.value = smsRepository.getMessagesByIds(deletedIds)
                    filterMessages(_searchQuery.value)
                } catch (e: CancellationException) {
                    // A newer loadMessages() call cancelled this one (see the comment
                    // above) — not a real failure, so it must not surface as one, and
                    // it must be rethrown for structured concurrency to see the job as
                    // actually cancelled rather than swallowed.
                    throw e
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to load messages", e)
                    _errorMessage.value = "Couldn't load messages"
                } finally {
                    // Only touch shared state if this run wasn't the one cancelled —
                    // otherwise a superseded job's finally can flip isLoading back to
                    // false after the newer job already set it true.
                    if (isActive) _isLoading.value = false
                }
            }
    }

    fun updateSearchQuery(query: String) {
        _searchQuery.value = query
        filterMessages(query)
    }

    fun setFilter(filter: MessageFilter) {
        _selectedFilter.value = filter
        exitSelectionMode()
        filterMessages(_searchQuery.value)
    }

    private fun isToday(timestamp: Long): Boolean {
        val cal = java.util.Calendar.getInstance()
        val todayStart =
            cal
                .apply {
                    set(java.util.Calendar.HOUR_OF_DAY, 0)
                    set(java.util.Calendar.MINUTE, 0)
                    set(java.util.Calendar.SECOND, 0)
                    set(java.util.Calendar.MILLISECOND, 0)
                }.timeInMillis
        return timestamp >= todayStart
    }

    private fun filterMessages(query: String) {
        val all = allMessages.value
        val filtered =
            if (query.isEmpty()) {
                all
            } else {
                all.filter {
                    it.sender.contains(query, ignoreCase = true) ||
                        it.body.contains(query, ignoreCase = true)
                }
            }

        _inboxMessages.value = filtered

        val spam = filtered.filter { it.classification == "spam" }
        _suspiciousMessages.value = spam
        _suspiciousTodayCount.value = spam.count { isToday(it.timestamp) }

        val unknown = filtered.filter { it.classification == "unknown" }
        _unknownMessages.value = unknown
        _unknownTodayCount.value = unknown.count { isToday(it.timestamp) }

        // Team rule: confirmed scams are auto-blocked and live only in the
        // Alerts tab; promotional/ad content goes to the Spam chip; the main
        // Messages list keeps only legitimate/unclassified mail.
        val legitimate =
            filtered.filter {
                it.classification != "spam" && it.classification != "blocked"
            }
        val deletedFiltered =
            if (query.isEmpty()) {
                recentlyDeleted.value
            } else {
                recentlyDeleted.value.filter {
                    it.sender.contains(query, ignoreCase = true) || it.body.contains(query, ignoreCase = true)
                }
            }
        val draftsFiltered =
            if (query.isEmpty()) {
                draftRows.value
            } else {
                draftRows.value.filter {
                    it.sender.contains(query, ignoreCase = true) || it.body.contains(query, ignoreCase = true)
                }
            }
        // Grouped to one row per sender — see groupedBySenderLatest() — so a sender
        // with several messages shows as one conversation, not one row per text.
        // Recently Deleted groups the same way for consistency with every other
        // filter; restoreSelected()/permanentlyDeleteSelected() expand a selected
        // row back out to every deleted id for that sender, same pattern as delete.
        // Drafts is already one row per recipient (DraftsStore itself is keyed that
        // way), so no grouping needed there.
        _visibleMessages.value =
            when (_selectedFilter.value) {
                MessageFilter.MESSAGES -> legitimate.groupedBySenderLatest()
                MessageFilter.SPAM -> spam.groupedBySenderLatest()
                MessageFilter.UNKNOWN -> unknown.groupedBySenderLatest()
                MessageFilter.RECENTLY_DELETED -> deletedFiltered.groupedBySenderLatest()
                MessageFilter.UNREAD -> legitimate.filter { !it.isRead }.groupedBySenderLatest()
                MessageFilter.DRAFTS -> draftsFiltered
            }
    }

    // --- Selection mode -----------------------------------------------------

    fun enterSelectionMode(id: Long) {
        _selectionMode.value = true
        _selectedIds.value = setOf(id)
    }

    fun toggleSelected(id: Long) {
        _selectedIds.value =
            if (id in _selectedIds.value) {
                _selectedIds.value - id
            } else {
                _selectedIds.value + id
            }
    }

    fun selectAll() {
        _selectedIds.value = _visibleMessages.value.map { it.id }.toSet()
    }

    fun exitSelectionMode() {
        _selectionMode.value = false
        _selectedIds.value = emptySet()
    }

    /** Soft-deletes the current selection. Not valid from the Recently Deleted or Drafts filters. */
    fun deleteSelected() {
        val selectedRows = _visibleMessages.value.filter { it.id in _selectedIds.value }
        if (selectedRows.isEmpty()) return
        val filter = _selectedFilter.value
        viewModelScope.launch(Dispatchers.IO) {
            // Each selected row represents a conversation (its latest message) — expand
            // back out to every message id in that sender's thread that actually
            // belongs to the filter being viewed, not the sender's entire history.
            // Deleting a row from Spam, for example, must not silently also delete
            // that same sender's unrelated Safe messages the user never saw or
            // selected — Messages/Unread are the exception since they already show
            // the full non-spam thread (getConversationBySender already excludes
            // Blocked entirely, since that lives only in Alerts now).
            val idsToDelete = mutableSetOf<Long>()
            for (row in selectedRows) {
                val conversation = smsRepository.getConversationBySender(row.sender)
                val matching =
                    when (filter) {
                        MessageFilter.SPAM -> conversation.filter { it.classification == "spam" }
                        MessageFilter.UNKNOWN -> conversation.filter { it.classification == "unknown" }
                        else -> conversation
                    }
                idsToDelete += matching.map { it.id }
                idsToDelete += row.id
            }
            deletedMessagesStore.markDeleted(idsToDelete)
            exitSelectionMode()
            loadMessages()
        }
    }

    // Recently Deleted rows are grouped by sender same as everywhere else, so a
    // selected row's id is only its latest deleted message — expand to every
    // currently soft-deleted id for that sender, mirroring deleteSelected()'s
    // conversation expansion.
    private fun expandDeletedSelectionToSenders(selectedRows: List<SmsMessage>): Set<Long> {
        val ids = mutableSetOf<Long>()
        for (row in selectedRows) {
            val key = normalizeSenderKey(row.sender)
            ids += recentlyDeleted.value.filter { normalizeSenderKey(it.sender) == key }.map { it.id }
            ids += row.id
        }
        return ids
    }

    /** Restores the current selection out of Recently Deleted back to its original list. */
    fun restoreSelected() {
        val selectedRows = _visibleMessages.value.filter { it.id in _selectedIds.value }
        if (selectedRows.isEmpty()) return
        viewModelScope.launch(Dispatchers.IO) {
            deletedMessagesStore.clear(expandDeletedSelectionToSenders(selectedRows))
            exitSelectionMode()
            loadMessages()
        }
    }

    /** Real, irreversible deletion from the phone's SMS database. Only valid from Recently Deleted. */
    fun permanentlyDeleteSelected() {
        val selectedRows = _visibleMessages.value.filter { it.id in _selectedIds.value }
        if (selectedRows.isEmpty()) return
        viewModelScope.launch(Dispatchers.IO) {
            val ids = expandDeletedSelectionToSenders(selectedRows)
            smsRepository.deletePermanently(ids)
            deletedMessagesStore.clear(ids)
            exitSelectionMode()
            loadMessages()
        }
    }
}
