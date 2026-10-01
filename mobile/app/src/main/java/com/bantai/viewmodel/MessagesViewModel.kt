package com.bantai.viewmodel

import android.app.Application
import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.Telephony
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.container
import com.bantai.data.MessageClassifier
import com.bantai.data.OutgoingSms
import com.bantai.data.SmsIngestPipeline
import com.bantai.data.model.Classification
import com.bantai.data.model.ConversationView
import com.bantai.data.model.SmsMessage
import com.bantai.data.model.groupedBySenderLatest
import com.bantai.data.model.normalizeSenderKey
import com.bantai.util.BlockHelper
import com.bantai.util.ContactNames
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

private const val TAG = "MessagesViewModel"

/** The slice of a sender's thread that opening a row from [filter] shows. */
fun conversationViewFor(filter: MessageFilter): ConversationView =
    when (filter) {
        MessageFilter.MESSAGES, MessageFilter.UNREAD -> ConversationView.MESSAGES
        MessageFilter.SPAM -> ConversationView.SPAM
        MessageFilter.UNKNOWN -> ConversationView.UNKNOWN
        MessageFilter.RECENTLY_DELETED -> ConversationView.DELETED
        MessageFilter.DRAFTS -> ConversationView.ALL
    }

// Upper bound on messages read for the list: every real inbox fits; it only
// guards memory against a pathological one.
private const val MESSAGE_LIST_CAP = 20_000

// How long provider changes must go quiet before the list reloads.
private const val RELOAD_DEBOUNCE_MS = 300L

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
    private val smsRepository = application.container.smsRepository
    private val userPreferences = application.container.userPreferences
    private val deletedMessagesStore = application.container.deletedMessagesStore
    private val draftsStore = application.container.draftsStore
    private val classificationStore = application.container.classificationStore
    private val backendMessageIdStore = application.container.backendMessageIdStore
    private val blockedSendersStore = application.container.blockedSendersStore

    // Senders the user blocked (BantAI's record plus Android's own block list),
    // as normalizeSenderKey keys. Their threads leave Messages/Spam/Review and
    // are reached from Blocked Numbers instead; unblocking brings them back.
    @Volatile private var blockedKeys: Set<String> = emptySet()

    private val allMessages = MutableStateFlow<List<SmsMessage>>(emptyList())

    // Messages this phone sent; merged into the Messages list so a conversation
    // started from Compose (no reply yet) shows up and can be reopened.
    private val sentMessages = MutableStateFlow<List<SmsMessage>>(emptyList())

    // Every filter's grouped list from the last recompute, so switching filters
    // is a lookup instead of regrouping hundreds of messages on the UI thread
    // (which made Messages -> Spam -> Unknown lag on phones with big inboxes).
    @Volatile private var groupedCache: Map<MessageFilter, List<SmsMessage>> = emptyMap()
    private var filterJob: Job? = null

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

    // Conversations per filter, for the counts on the Messages tab's filter chips.
    private val _filterCounts = MutableStateFlow<Map<MessageFilter, Int>>(emptyMap())
    val filterCounts: StateFlow<Map<MessageFilter, Int>> = _filterCounts.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private var loadJob: Job? = null

    // Set once the first inbox read has landed in allMessages. Regroups that run
    // before it (drafts/pending-send collectors fire at startup) see an empty
    // inbox and must not clear the skeleton, or "No messages" flashes on launch.
    @Volatile private var inboxLoaded = false

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

        // ~85 requests/minute: under the backend's 120/min per-IP limit, with
        // room left for alert polling and live SMS from the same phone.
        private const val SCAN_PACING_MS = 700L
        private const val SCAN_BACKOFF_MS = 60_000L
        private const val SCAN_MAX_BACKOFFS = 3

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
    // Changes arrive in bursts (several texts at once, a batch of read marks), so
    // they're collected and turned into one reload once the burst settles.
    private val providerChanges =
        MutableSharedFlow<Unit>(extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    private val contentObserver =
        object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) {
                providerChanges.tryEmit(Unit)
            }
        }

    init {
        OutgoingSms.ensureLoaded(application)
        loadMessages()
        viewModelScope.launch {
            @OptIn(FlowPreview::class)
            providerChanges.debounce(RELOAD_DEBOUNCE_MS).collect { loadMessages() }
        }
        // A send shows up in the list the moment it starts ("Sending…"), and
        // messages Android wouldn't store stay listed -- both live in pending.
        viewModelScope.launch {
            OutgoingSms.pending.collect { filterMessages(_searchQuery.value) }
        }
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
        // MMS arriving or finishing its download (see MmsDownloader).
        application.contentResolver.registerContentObserver(
            Telephony.Mms.CONTENT_URI,
            true,
            contentObserver,
        )
        // A live SMS is written to the provider (which reloads the list) before
        // its verdict comes back, so it first lists as unverified -- in Messages
        // and Unread. The verdict lands in the classification table afterwards,
        // with no provider change to trigger a reload, so without this an unread
        // spam text stayed under Unread and never reached Spam.
        viewModelScope.launch {
            classificationStore.classifications.collect { stored -> applyStoredClassifications(stored) }
        }
        // Every block/unblock BantAI makes goes through BlockedSendersStore, so
        // this re-filters the moment the user blocks someone from a thread.
        viewModelScope.launch(Dispatchers.IO) {
            blockedSendersStore.state.collect { state ->
                val onDevice = BlockHelper.getBlockedNumbers(application).map { it.number }
                blockedKeys = (state.blocked + onDevice).map(::normalizeSenderKey).toSet()
                filterMessages(_searchQuery.value)
            }
        }
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
                            classification = Classification.SAFE,
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

    /** The screen reports this on every start; only a real change (denied -> granted) reloads. */
    fun onPermissionGranted() {
        if (_hasPermission.value) return
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
                    // Every message, not just the newest 500: on a real inbox
                    // (4,300 texts across 154 conversations on a test phone) the
                    // 500 cap left most conversations out of the list entirely.
                    allMessages.value =
                        smsRepository
                            .getInboxMessages(limit = MESSAGE_LIST_CAP)
                            .filterNot { it.id in deletedIds }
                    sentMessages.value =
                        smsRepository.getSentMessages(limit = MESSAGE_LIST_CAP).filterNot { it.id in deletedIds }
                    recentlyDeleted.value = smsRepository.getMessagesByIds(deletedIds)
                    inboxLoaded = true
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
                    // On success recomputeFilters clears the skeleton once the list is ready.
                    _isLoading.value = false
                }
            }
    }

    /**
     * Sends inbox messages that never got a model verdict (history from before
     * install, or ones only checked by the offline heuristic while the backend
     * was unreachable) through the same masked classifier a live SMS uses, so
     * they land in the right Messages/Spam/Unknown chip. Silent: no
     * notifications for old messages. Newest first, so the texts people
     * actually look at are sorted soonest.
     *
     * Paced under the backend's 120 requests/minute per-IP throttle
     * (backend/src/app.module.ts). Unpaced, the scan hit it after ~120
     * messages, got a 429, read that as "model unavailable" and stopped --
     * leaving two-thirds of a real 3,135-message inbox unchecked, so scams sat
     * in Messages on the offline heuristic's say-so. Unavailable now waits
     * and retries a few times before giving up until the next reload.
     */
    @Suppress("CyclomaticComplexMethod") // scan loop with per-outcome handling
    private fun scanUnclassifiedMessages() {
        if (scanJob?.isActive == true) return
        scanJob =
            viewModelScope.launch(Dispatchers.IO) {
                val token = runCatching { userPreferences.userData.first().authToken }.getOrDefault("")
                if (token.isEmpty()) return@launch
                // The whole history (the list holds every message, see
                // MESSAGE_LIST_CAP): any row without a model verdict falls back
                // to the offline heuristic when its conversation is opened.
                val stored = classificationStore.classifications.first()
                val pending =
                    allMessages.value
                        .filter { msg ->
                            !msg.isOutgoing &&
                                msg.id > 0 &&
                                msg.id !in scanAttempted &&
                                (stored[msg.id] == null || stored[msg.id] == Classification.UNVERIFIED)
                        }.sortedByDescending { it.timestamp }
                for (batch in pending.chunked(SCAN_BATCH_SIZE)) {
                    if (!isActive) return@launch
                    val results = mutableMapOf<Long, Classification>()
                    var modelUnavailable = false
                    for (msg in batch) {
                        var outcome = classifyForScan(token, msg)
                        var backoffs = 0
                        while (outcome == SmsIngestPipeline.ScanOutcome.Unavailable && backoffs < SCAN_MAX_BACKOFFS) {
                            // Usually the throttle window; a minute clears it.
                            delay(SCAN_BACKOFF_MS)
                            backoffs++
                            outcome = classifyForScan(token, msg)
                        }
                        delay(SCAN_PACING_MS)
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
                    if (results.isNotEmpty()) applyScanResults(results)
                    if (modelUnavailable) return@launch
                }
            }
    }

    private suspend fun classifyForScan(
        token: String,
        msg: SmsMessage,
    ): SmsIngestPipeline.ScanOutcome =
        try {
            SmsIngestPipeline.classifyExisting(getApplication<Application>(), token, msg)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            Log.w(TAG, "Inbox scan failed for message ${msg.id}", e)
            SmsIngestPipeline.ScanOutcome.Skipped
        }

    // Newly scanned verdicts re-sort the chips. Only the scanned messages change,
    // so they're relabelled in memory -- same rules the repository applies on
    // read -- instead of re-reading the whole inbox after every batch.
    private fun applyScanResults(results: Map<Long, Classification>) {
        allMessages.update { messages ->
            messages.map { msg ->
                val scanned = results[msg.id] ?: return@map msg
                msg.copy(classification = MessageClassifier.resolve(scanned, msg.body, msg.sender))
            }
        }
        filterMessages(_searchQuery.value)
    }

    // Relabels inbox rows whose stored verdict changed since they were read,
    // and regroups the chips only when something actually moved.
    private fun applyStoredClassifications(stored: Map<Long, Classification>) {
        var changed = false
        allMessages.update { messages ->
            messages.map { msg ->
                val label = stored[msg.id]
                if (msg.isOutgoing || label == null) return@map msg
                val resolved = MessageClassifier.resolve(label, msg.body, msg.sender)
                if (resolved == msg.classification) {
                    msg
                } else {
                    changed = true
                    msg.copy(classification = resolved)
                }
            }
        }
        if (changed) filterMessages(_searchQuery.value)
    }

    fun updateSearchQuery(query: String) {
        _searchQuery.value = query
        filterMessages(query)
    }

    fun setFilter(filter: MessageFilter) {
        _selectedFilter.value = filter
        exitSelectionMode()
        val cached = groupedCache[filter]
        if (cached != null) _visibleMessages.value = cached else filterMessages(_searchQuery.value)
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

    private fun nameOf(address: String): String? = ContactNames.lookup(getApplication(), address)

    private fun SmsMessage.withName(): SmsMessage = copy(displayName = nameOf(sender))

    // Regroups every filter off the main thread; a newer call cancels an older one.
    private fun filterMessages(query: String) {
        filterJob?.cancel()
        filterJob = viewModelScope.launch(Dispatchers.Default) { recomputeFilters(query) { isActive } }
    }

    // Anyone the user has texted is a conversation that belongs in Messages,
    // even when their own texts were filed as Spam or Unknown (a short "test"
    // or "hi" from a friend usually reads as Unknown). Only senders flagged as
    // scams stay out -- they live in Alerts. The first version also required
    // the sender to have a regular Messages conversation already, which hid
    // exactly the threads people start from Compose with someone new.
    private fun sentForMessagesTab(
        hiddenSenders: Set<String>,
        query: String,
    ): List<SmsMessage> =
        (sentMessages.value + OutgoingSms.unsaved(sentMessages.value)).filter { sent ->
            normalizeSenderKey(sent.sender) !in hiddenSenders &&
                (query.isEmpty() || sent.sender.contains(query, true) || sent.body.contains(query, true))
        }

    // [isCurrent] is false once a newer regroup was started: this one's input is
    // stale, so it must not overwrite the newer result when it finishes late.
    private fun recomputeFilters(
        query: String,
        isCurrent: () -> Boolean,
    ) {
        val loaded = inboxLoaded // read before allMessages, so a true here means `all` is the loaded inbox
        val all = allMessages.value
        val filtered =
            if (query.isEmpty()) {
                all
            } else {
                all.filter {
                    it.sender.contains(query, ignoreCase = true) ||
                        it.body.contains(query, ignoreCase = true) ||
                        nameOf(it.sender)?.contains(query, ignoreCase = true) == true
                }
            }

        _inboxMessages.value = filtered

        // A scam blocks its sender (see SmsIngestPipeline.autoBlockSender), so
        // none of that sender's messages stay in Messages/Spam/Review -- the
        // scam lives in Alerts. Trusted senders never read as "blocked" (see
        // SmsRepository.resolveClassification), so they're never hidden here.
        val scamSenders =
            filtered
                .filter { it.classification == Classification.SCAM }
                .map { normalizeSenderKey(it.sender) }
                .toSet()
        // Blocked senders are hidden the same way (see blockedKeys).
        val hiddenSenders = scamSenders + blockedKeys
        val inbox = filtered.filterNot { normalizeSenderKey(it.sender) in hiddenSenders }

        val spam = inbox.filter { it.classification == Classification.SPAM }
        _suspiciousMessages.value = spam
        _suspiciousTodayCount.value = spam.count { isToday(it.timestamp) }

        val unknown = inbox.filter { it.classification == Classification.UNKNOWN }
        _unknownMessages.value = unknown
        _unknownTodayCount.value = unknown.count { isToday(it.timestamp) }

        // Team rule: confirmed scams are auto-blocked and live only in the
        // Alerts tab. Everything else is placed per message, so a sender that
        // mixes OTPs/balance notices with promos (GLOBE, AUTOLOADMAX, GCash)
        // shows up in Messages for the former and Spam for the latter; opening
        // it from a chip shows only that chip's messages (ConversationView).
        val legitimate = inbox.filter { ConversationView.MESSAGES.includes(it) }
        val conversations =
            (legitimate + sentForMessagesTab(hiddenSenders, query)).sortedByDescending { it.timestamp }
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
        // Rows show the latest message (not an "Unread summary: ..." digest,
        // which read as if the newest text were missing) and the contact name.
        fun List<SmsMessage>.rows() = groupedBySenderLatest(summarizeUnread = false).map { it.withName() }
        val grouped =
            mapOf(
                MessageFilter.MESSAGES to conversations.rows(),
                MessageFilter.SPAM to spam.rows(),
                MessageFilter.UNKNOWN to unknown.rows(),
                MessageFilter.RECENTLY_DELETED to deletedFiltered.rows(),
                MessageFilter.UNREAD to legitimate.filter { !it.isRead }.rows(),
                MessageFilter.DRAFTS to draftsFiltered.map { it.withName() },
            )
        if (isCurrent()) publish(grouped, loaded)
    }

    private fun publish(
        grouped: Map<MessageFilter, List<SmsMessage>>,
        inboxLoaded: Boolean,
    ) {
        groupedCache = grouped
        _filterCounts.value = grouped.mapValues { it.value.size }
        _visibleMessages.value = grouped.getValue(_selectedFilter.value)
        // The skeleton stays until the loaded inbox's grouped list is out.
        if (inboxLoaded) _isLoading.value = false
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
                idsToDelete +=
                    smsRepository
                        .getConversationBySender(row.sender)
                        .filter { view.includes(it) }
                        .map { it.id }
                idsToDelete += row.id
                // Messages with no SMS-store row (kept or in flight) for this sender.
                val key = normalizeSenderKey(row.sender)
                idsToDelete +=
                    OutgoingSms.pending.value
                        .filter { normalizeSenderKey(it.sender) == key }
                        .map { it.id }
            }
            val (localIds, providerIds) = idsToDelete.partition { it < 0 }
            OutgoingSms.discard(localIds, getApplication())
            deletedMessagesStore.markDeleted(providerIds)
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
            getApplication<Application>().container.smsWriter.deletePermanently(ids)
            deletedMessagesStore.clear(ids)
            // The row is gone from the SMS provider for good -- its cached
            // classification and backend-message-id mapping are meaningless
            // now and would otherwise sit in these stores forever (a real SMS
            // row id is never reused, so nothing will ever look them up again).
            classificationStore.remove(ids)
            backendMessageIdStore.remove(ids)
            getApplication<Application>().container.campaignMatchStore.remove(ids)
            exitSelectionMode()
            loadMessages()
        }
    }
}
