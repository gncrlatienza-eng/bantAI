package com.bantai.viewmodel

import android.app.Application
import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.Telephony
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.data.SmsIngestPipeline
import com.bantai.data.SmsRepository
import com.bantai.data.local.BackendMessageIdStore
import com.bantai.data.local.CampaignMatchStore
import com.bantai.data.local.ClassificationStore
import com.bantai.data.local.DeletedMessagesStore
import com.bantai.data.local.DraftsStore
import com.bantai.data.local.UserPreferences
import com.bantai.data.model.ConversationView
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

/** The slice of a sender's thread that opening a row from [filter] shows. */
fun conversationViewFor(filter: MessageFilter): ConversationView =
    when (filter) {
        MessageFilter.MESSAGES, MessageFilter.UNREAD -> ConversationView.MESSAGES
        MessageFilter.SPAM -> ConversationView.SPAM
        MessageFilter.UNKNOWN -> ConversationView.UNKNOWN
        MessageFilter.RECENTLY_DELETED, MessageFilter.DRAFTS -> ConversationView.ALL
    }

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
    private val classificationStore = ClassificationStore(application)
    private val backendMessageIdStore = BackendMessageIdStore(application)

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

    private var scanJob: Job? = null

    // Ids already sent this session, whether or not the model answered, so a
    // message that keeps failing can't stall the scan at the front of every
    // batch. Cleared with the ViewModel, so the next app session retries them.
    private val scanAttempted = mutableSetOf<Long>()

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
        private const val SCAN_BATCH_SIZE = 20

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
                // The skeleton is for the first load only. A refresh (coming back
                // from a thread, a new SMS) updates the list in place -- swapping it
                // for the skeleton threw away the scroll position, so returning from
                // a conversation always jumped back to the top.
                if (allMessages.value.isEmpty()) _isLoading.value = true
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
                    scanUnclassifiedMessages()
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

    /**
     * Sends inbox messages that never got a model verdict (history from before
     * install, or ones only checked by the offline heuristic while the backend
     * was unreachable) through the same masked classifier a live SMS uses, so
     * they land in the right Messages/Spam/Unknown chip. Silent: no
     * notifications for old messages. Stops as soon as the model is unavailable
     * and retries on a later reload.
     */
    private fun scanUnclassifiedMessages() {
        if (scanJob?.isActive == true) return
        scanJob =
            viewModelScope.launch(Dispatchers.IO) {
                val token = runCatching { userPreferences.userData.first().authToken }.getOrDefault("")
                if (token.isEmpty()) return@launch
                // The whole history, not just the 500 rows the list shows:
                // opening a conversation loads every message from that sender,
                // and any row without a model verdict falls back to the offline
                // heuristic there.
                val stored = classificationStore.classifications.first()
                val pending =
                    smsRepository.getInboxMessages().filter { msg ->
                        !msg.isOutgoing &&
                            msg.id > 0 &&
                            msg.id !in scanAttempted &&
                            (stored[msg.id] == null || stored[msg.id] == "unverified")
                    }
                for (batch in pending.chunked(SCAN_BATCH_SIZE)) {
                    if (!isActive) return@launch
                    val results = mutableMapOf<Long, String>()
                    var modelUnavailable = false
                    for (msg in batch) {
                        val outcome =
                            try {
                                SmsIngestPipeline.classifyExisting(getApplication<Application>(), token, msg)
                            } catch (e: CancellationException) {
                                throw e
                            } catch (e: Exception) {
                                Log.w(TAG, "Inbox scan failed for message ${msg.id}", e)
                                SmsIngestPipeline.ScanOutcome.Skipped
                            }
                        scanAttempted += msg.id
                        when (outcome) {
                            is SmsIngestPipeline.ScanOutcome.Classified -> results[msg.id] = outcome.classification
                            SmsIngestPipeline.ScanOutcome.Skipped -> Unit
                            SmsIngestPipeline.ScanOutcome.Unavailable -> {
                                // Not this message's fault -- let the next session retry it.
                                scanAttempted -= msg.id
                                modelUnavailable = true
                            }
                        }
                        if (modelUnavailable) break
                    }
                    classificationStore.setClassifications(results)
                    if (results.isNotEmpty()) refreshAfterScan()
                    if (modelUnavailable) return@launch
                }
            }
    }

    // Re-reads the provider so newly stored classifications re-sort the chips,
    // without re-triggering the scan that is already running.
    private suspend fun refreshAfterScan() {
        val deletedIds = deletedMessagesStore.deletedEntries.first().map { it.id }.toSet()
        allMessages.value = smsRepository.getInboxMessages(limit = 500).filterNot { it.id in deletedIds }
        filterMessages(_searchQuery.value)
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

        // A scam blocks its sender (see SmsIngestPipeline.autoBlockSender), so
        // none of that sender's messages stay in Messages/Spam/Review -- the
        // scam lives in Alerts. Trusted senders never read as "blocked" (see
        // SmsRepository.resolveClassification), so they're never hidden here.
        val scamSenders =
            filtered
                .filter { it.classification == "blocked" }
                .map { normalizeSenderKey(it.sender) }
                .toSet()
        val inbox = filtered.filterNot { normalizeSenderKey(it.sender) in scamSenders }

        val spam = inbox.filter { it.classification == "spam" }
        _suspiciousMessages.value = spam
        _suspiciousTodayCount.value = spam.count { isToday(it.timestamp) }

        val unknown = inbox.filter { it.classification == "unknown" }
        _unknownMessages.value = unknown
        _unknownTodayCount.value = unknown.count { isToday(it.timestamp) }

        // Team rule: confirmed scams are auto-blocked and live only in the
        // Alerts tab. Everything else is placed per message, so a sender that
        // mixes OTPs/balance notices with promos (GLOBE, AUTOLOADMAX, GCash)
        // shows up in Messages for the former and Spam for the latter; opening
        // it from a chip shows only that chip's messages (ConversationView).
        val legitimate = inbox.filter { ConversationView.MESSAGES.includes(it) }
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
            // Each selected row is a sender's slice for this chip (its latest
            // message) -- delete exactly what opening that row shows, so clearing
            // GLOBE's promos from Spam never touches its OTPs in Messages.
            // getConversationBySender already excludes Blocked, which lives in Alerts.
            val view = conversationViewFor(filter)
            val idsToDelete = mutableSetOf<Long>()
            for (row in selectedRows) {
                idsToDelete += smsRepository.getConversationBySender(row.sender).filter { view.includes(it) }.map { it.id }
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
            // The row is gone from the SMS provider for good -- its cached
            // classification and backend-message-id mapping are meaningless
            // now and would otherwise sit in these stores forever (a real SMS
            // row id is never reused, so nothing will ever look them up again).
            classificationStore.remove(ids)
            backendMessageIdStore.remove(ids)
            CampaignMatchStore(getApplication()).remove(ids)
            exitSelectionMode()
            loadMessages()
        }
    }
}
