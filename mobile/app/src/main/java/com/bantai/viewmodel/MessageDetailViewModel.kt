package com.bantai.viewmodel

import android.app.Application
import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.Telephony
import android.util.Log
import androidx.annotation.WorkerThread
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.BuildConfig
import com.bantai.container
import com.bantai.data.GroupThreads
import com.bantai.data.OutgoingSms
import com.bantai.data.PENDING_MMS_ID_OFFSET
import com.bantai.data.db.BantaiDatabase
import com.bantai.data.db.ReplyQuoteEntity
import com.bantai.data.isPendingMmsId
import com.bantai.data.model.SmsMessage
import com.bantai.data.model.isGroupKey
import com.bantai.data.model.matchReplyQuotes
import com.bantai.data.model.normalizeSenderKey
import com.bantai.data.remote.VerificationApi
import com.bantai.util.ContactNames
import com.bantai.util.NotificationHelper
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.mapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

private const val TAG = "MessageDetailViewModel"

// Messages loaded per page of a conversation.
private const val PAGE_SIZE = 300

// How long provider changes must go quiet before the thread reloads.
private const val THREAD_RELOAD_DEBOUNCE_MS = 200L

@Suppress("TooManyFunctions") // one thread: load, read, drafts, selection, delete/recover
class MessageDetailViewModel(
    application: Application,
) : AndroidViewModel(application) {
    private val smsRepository = application.container.smsRepository
    private val deletedMessagesStore = application.container.deletedMessagesStore
    private val draftsStore = application.container.draftsStore
    private val backendMessageIdStore = application.container.backendMessageIdStore
    private val userPreferences = application.container.userPreferences

    private val _conversation = MutableStateFlow<List<SmsMessage>>(emptyList())

    // Provider rows plus any "Sending…"/"Not delivered" bubble, or kept sent
    // message, OutgoingSms holds because the provider couldn't store it.
    // The sender is part of the combine, not read from a plain field: a thread
    // whose only messages are unsaved bubbles loads as an empty list, which
    // StateFlow doesn't re-emit, so reopening it showed "No messages here"
    // until the next send happened to change [OutgoingSms.pending].
    private val currentSenderFlow = MutableStateFlow<String?>(null)

    val conversation: StateFlow<List<SmsMessage>> =
        combine(_conversation, OutgoingSms.pending, currentSenderFlow) { provider, _, sender ->
            // Unsaved bubbles belong to the live thread, never to Recently Deleted.
            if (deletedOnly) provider else sender?.let { OutgoingSms.mergeInto(it, provider) } ?: provider
        }.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    private val replyQuoteDao = BantaiDatabase.get(application).replyQuotes()

    /** Sent messages in this thread that were replies, keyed by message id (shown on this phone only). */
    @OptIn(ExperimentalCoroutinesApi::class)
    val replyQuotes: StateFlow<Map<Long, ReplyQuoteEntity>> =
        combine(
            conversation,
            currentSenderFlow.flatMapLatest { sender ->
                if (sender == null) flowOf(emptyList()) else replyQuoteDao.forConversation(normalizeSenderKey(sender))
            },
        ) { messages, quotes -> matchReplyQuotes(messages, quotes) }
            .stateIn(viewModelScope, SharingStarted.Eagerly, emptyMap())

    // Backend verdict on the sender (trusted org, known contact, confirmed
    // fraud); null until loaded, or when signed out/offline.
    private val _senderVerification = MutableStateFlow<VerificationApi.SenderVerification?>(null)
    val senderVerification: StateFlow<VerificationApi.SenderVerification?> = _senderVerification.asStateFlow()

    private val _contactName = MutableStateFlow<String?>(null)
    val contactName: StateFlow<String?> = _contactName.asStateFlow()

    // Group threads only: each member's display name, keyed by normalized number.
    private val _memberNames = MutableStateFlow<Map<String, String>>(emptyMap())
    val memberNames: StateFlow<Map<String, String>> = _memberNames.asStateFlow()

    /**
     * The backend messageId of this thread's most recently flagged message.
     * TakeAction's Report needs that backend UUID, which the SMS provider row
     * has no column for (see BackendMessageIdStore). Empty when none.
     */
    @OptIn(ExperimentalCoroutinesApi::class)
    val flaggedMessageId: StateFlow<String> =
        conversation
            .map { messages -> messages.lastOrNull { it.classification.isFlagged }?.id }
            .distinctUntilChanged()
            .mapLatest { id -> id?.let { backendMessageIdStore.get(it) }.orEmpty() }
            .flowOn(Dispatchers.IO)
            .stateIn(viewModelScope, SharingStarted.Eagerly, "")

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private var loadJob: Job? = null

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

    private var currentSender: String?
        get() = currentSenderFlow.value
        set(value) {
            currentSenderFlow.value = value
        }

    // True when opened from Recently Deleted: the thread shows only this
    // sender's deleted messages, which can be recovered or deleted for good.
    private var deletedOnly = false

    fun showDeletedOnly(enabled: Boolean) {
        deletedOnly = enabled
    }

    // The SMS provider gives no push signal on its own — without this, a thread
    // left open would never show a message that arrives while you're looking at it.
    private val contentObserver =
        object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) {
                providerChanges.tryEmit(Unit)
            }
        }

    // Bursts of provider changes (a send writes the row, then its status) become one reload.
    private val providerChanges =
        MutableSharedFlow<Unit>(extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)

    init {
        OutgoingSms.ensureLoaded(application)
        viewModelScope.launch {
            @OptIn(FlowPreview::class)
            providerChanges.debounce(THREAD_RELOAD_DEBOUNCE_MS).collect {
                currentSender?.let { loadConversation(it) }
            }
        }
        getApplication<Application>().contentResolver.registerContentObserver(
            Telephony.Sms.CONTENT_URI,
            true,
            contentObserver,
        )
        // MMS arriving or finishing its download (see MmsDownloader).
        getApplication<Application>().contentResolver.registerContentObserver(
            Telephony.Mms.CONTENT_URI,
            true,
            contentObserver,
        )
    }

    // How many of the newest messages to load; grows when the user scrolls to
    // the top (loadOlder). A thread used to stop at its newest 500 for good.
    private var loadLimit = PAGE_SIZE

    /** True while the loaded window is full, i.e. older messages may exist. */
    private val _canLoadOlder = MutableStateFlow(false)
    val canLoadOlder: StateFlow<Boolean> = _canLoadOlder.asStateFlow()

    // Set by the screen while this thread is actually on screen: new messages
    // are then marked read as they arrive (they used to stay unread).
    @Volatile private var visible = false

    fun setVisible(isVisible: Boolean) {
        visible = isVisible
        // Off the main thread like markAsRead: marking read writes the SMS
        // provider and, for BantAI's own rows, Room -- which throws on the main
        // thread (crashed opening an unread conversation from Unread).
        if (isVisible) currentSender?.let { sender -> viewModelScope.launch(Dispatchers.IO) { markLoadedRead(sender) } }
    }

    fun loadOlder() {
        val sender = currentSender ?: return
        if (!_canLoadOlder.value) return
        loadLimit += PAGE_SIZE
        loadConversation(sender)
    }

    fun loadConversation(sender: String) {
        if (currentSender != sender) loadLimit = PAGE_SIZE
        currentSender = sender
        // Cancels any in-flight load before starting a new one — loadConversation()
        // fires concurrently from the initial screen entry, the content observer, and
        // deleteSelected(), so an in-progress load and a fresh one could otherwise race
        // to write _conversation out of order.
        loadJob?.cancel()
        loadJob =
            viewModelScope.launch(Dispatchers.IO) {
                // Skeleton only before the first load. Every send and every new
                // message reloads the thread (twice per send), and swapping the
                // whole thread for a skeleton each time made it blink and jump.
                if (_conversation.value.isEmpty()) _isLoading.value = true
                _errorMessage.value = null
                try {
                    val deletedIds =
                        deletedMessagesStore.deletedEntries
                            .first()
                            .map { it.id }
                            .toSet()
                    val rows = smsRepository.getConversationBySender(sender, loadLimit)
                    _canLoadOlder.value = rows.size >= loadLimit
                    _conversation.value = rows.filter { (it.id in deletedIds) == deletedOnly }
                    if (visible && !deletedOnly) markLoadedRead(sender)
                    val senderKey = normalizeSenderKey(sender)
                    _draftBody.value = draftsStore.drafts
                        .first()
                        .firstOrNull { normalizeSenderKey(it.address) == senderKey }
                        ?.body ?: ""
                } catch (e: CancellationException) {
                    // Superseded by a newer load (each send reloads the thread) --
                    // not a failure, so no "Couldn't load" error.
                    throw e
                } catch (e: Exception) {
                    if (BuildConfig.DEBUG) Log.e(TAG, "Failed to load conversation for $sender", e)
                    _errorMessage.value = "Couldn't load this conversation"
                } finally {
                    // Only the newest load may clear the skeleton.
                    if (isActive) _isLoading.value = false
                }
            }
    }

    // Called once per screen visit (not from the ContentObserver's reload path,
    // which would re-trigger on this update and risk a refresh loop).
    fun markAsRead(sender: String) {
        viewModelScope.launch(Dispatchers.IO) { markLoadedRead(sender) }
    }

    // Marks read exactly the unread messages this screen shows -- opening a
    // thread from Spam no longer marks the sender's Messages-side texts read --
    // and clears the conversation's notification.
    @WorkerThread
    private fun markLoadedRead(sender: String) {
        val unread = _conversation.value.filter { !it.isOutgoing && !it.isRead }.map { it.id }
        if (unread.isNotEmpty()) getApplication<Application>().container.smsWriter.markMessagesRead(unread)
        NotificationHelper.cancelConversation(getApplication(), sender)
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

    /** "Tap to download" on an MMS whose download failed. */
    fun retryMmsDownload(id: Long) {
        if (!isPendingMmsId(id)) return
        viewModelScope.launch(Dispatchers.IO) {
            getApplication<Application>().container.mmsDownloader.retry(id - PENDING_MMS_ID_OFFSET)
        }
    }

    fun toggleSelected(id: Long) {
        _selectedIds.value =
            if (id in _selectedIds.value) {
                _selectedIds.value - id
            } else {
                _selectedIds.value + id
            }
    }

    /** Selects [visibleIds] -- the screen may be showing only one chip's slice of the thread. */
    fun selectAll(visibleIds: Collection<Long> = conversation.value.map { it.id }) {
        _selectedIds.value = visibleIds.toSet()
    }

    fun exitSelectionMode() {
        _selectionMode.value = false
        _selectedIds.value = emptySet()
    }

    /** Recently Deleted: puts [ids] (the selection, or every message shown) back in the thread. */
    fun recover(ids: Collection<Long>) {
        if (ids.isEmpty()) return
        viewModelScope.launch(Dispatchers.IO) {
            deletedMessagesStore.clear(ids)
            exitSelectionMode()
            currentSender?.let { loadConversation(it) }
        }
    }

    /** Loads who [sender] is: saved contact name, and the backend's verdict on the sender. */
    fun loadSenderDetails(sender: String) {
        _senderVerification.value = null
        _contactName.value = null
        _memberNames.value = emptyMap()
        viewModelScope.launch(Dispatchers.IO) {
            _contactName.value = ContactNames.lookup(getApplication(), sender)
            if (isGroupKey(sender)) {
                // A group has no single sender to verify; its bubbles are labelled by member instead.
                _memberNames.value =
                    GroupThreads.participantsOf(getApplication(), sender).associate {
                        normalizeSenderKey(it) to (ContactNames.lookup(getApplication(), it) ?: it)
                    }
                return@launch
            }
            val token = userPreferences.userData.first().authToken
            if (token.isNotEmpty()) {
                _senderVerification.value = VerificationApi.verifySender(token, sender).getOrNull()
            }
        }
    }

    /** Saves what [body] is replying to, so its sent bubble can show the quote. */
    fun rememberReplyQuote(
        body: String,
        quoted: SmsMessage,
    ) {
        val sender = currentSender ?: return
        val entry =
            ReplyQuoteEntity(
                addressKey = normalizeSenderKey(sender),
                body = body,
                sentAt = System.currentTimeMillis(),
                quotedOutgoing = quoted.isOutgoing,
                quotedBody = quoted.mms?.text?.ifBlank { null } ?: quoted.body,
            )
        viewModelScope.launch { replyQuoteDao.insert(entry) }
    }

    /**
     * Removes [ids] from the phone for good: from Recently Deleted, and for
     * messages deleted inside a thread (single messages skip Recently Deleted,
     * which only holds whole conversations).
     */
    fun deletePermanently(ids: Collection<Long>) {
        if (ids.isEmpty()) return
        // "Sending…"/"Not delivered" bubbles that were never stored.
        OutgoingSms.discard(ids.filter { it < 0 })
        viewModelScope.launch(Dispatchers.IO) {
            getApplication<Application>().container.smsWriter.deletePermanently(ids)
            deletedMessagesStore.clear(ids)
            getApplication<Application>().container.classificationStore.remove(ids)
            backendMessageIdStore.remove(ids)
            getApplication<Application>().container.campaignMatchStore.remove(ids)
            exitSelectionMode()
            currentSender?.let { loadConversation(it) }
        }
    }
}
