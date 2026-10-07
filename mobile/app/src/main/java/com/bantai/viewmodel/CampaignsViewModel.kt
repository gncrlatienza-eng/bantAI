package com.bantai.viewmodel

import android.app.Application
import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.Telephony
import android.util.Log
import androidx.compose.runtime.mutableStateMapOf
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.container
import com.bantai.data.SmsIngestPipeline
import com.bantai.data.model.Classification
import com.bantai.data.model.LocalCampaignOverview
import com.bantai.data.model.LocalScamMessage
import com.bantai.data.model.SmsMessage
import com.bantai.data.model.buildLocalCampaigns
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private const val TAG = "CampaignsViewModel"

// Messages this phone treats as scam or suspicious (see routeServerClassification
// / applyOfflineCaution). Spam is promotional and deliberately left out.
private val SCAM_CLASSIFICATIONS = setOf(Classification.SCAM, Classification.UNKNOWN)

// Older messages never checked against campaigns are re-sent a batch at a
// time, so opening the tab never fires hundreds of requests at once.
private const val MAX_MATCH_BACKFILL = 40

sealed interface OpenTarget {
    data class Thread(
        val sender: String,
    ) : OpenTarget

    data class Alert(
        val backendMessageId: String,
    ) : OpenTarget
}

data class CampaignsUiState(
    val overview: LocalCampaignOverview? = null,
    val isLoading: Boolean = true,
    /** Non-null while older messages are being matched against known campaigns. */
    val matchingProgress: String? = null,
    /** Why known-campaign matching couldn't run; local grouping still shows. */
    val matchingNote: String? = null,
    val errorMessage: String? = null,
)

/**
 * The Campaigns tab is built on this phone from this phone's own scam
 * messages -- see LocalCampaigns.kt. The backend only contributes which known
 * campaign (if any) each message matched, recorded at ingest time.
 */
class CampaignsViewModel(
    application: Application,
) : AndroidViewModel(application) {
    private val userPreferences = application.container.userPreferences
    private val smsRepository = application.container.smsRepository
    private val matchStore = application.container.campaignMatchStore
    private val classificationStore = application.container.classificationStore

    private val _state = MutableStateFlow(CampaignsUiState())
    val state: StateFlow<CampaignsUiState> = _state.asStateFlow()

    private var loadJob: Job? = null

    /**
     * Which campaign rows are open, keyed by LocalCampaign.key (plus
     * "unmatched"). Kept here rather than in the screen so opening a message
     * and coming back finds the same rows still open.
     */
    val expanded = mutableStateMapOf<String, Boolean>()

    // Whether the inbox or a verdict changed since the last load. Building the
    // tab reads every SMS and re-runs the classifier rules on each, which used
    // to happen on every visit and made switching to Scam Waves stutter; now
    // a visit reuses the last result unless something actually changed.
    @Volatile private var stale = true

    private val smsObserver =
        object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) {
                stale = true
            }
        }

    init {
        application.contentResolver.registerContentObserver(Telephony.Sms.CONTENT_URI, true, smsObserver)
        viewModelScope.launch {
            // drop(1): the first emission is the current state, not a change.
            classificationStore.classifications.drop(1).collect { stale = true }
        }
        refreshIfStale()
    }

    override fun onCleared() {
        getApplication<Application>().contentResolver.unregisterContentObserver(smsObserver)
    }

    /** For each visit to the tab: reload only when the inbox or a verdict changed since the last load. */
    fun refreshIfStale() {
        if (!stale && _state.value.overview != null) return
        stale = false
        loadCampaigns()
    }

    fun loadCampaigns() {
        if (loadJob?.isActive == true) return
        loadJob =
            viewModelScope.launch {
                _state.value = _state.value.copy(isLoading = _state.value.overview == null, errorMessage = null)
                if (!smsRepository.hasReadSmsPermission()) {
                    _state.value =
                        CampaignsUiState(isLoading = false, errorMessage = "Allow SMS access to see campaigns")
                    return@launch
                }

                val scamMessages = loadScamMessages()
                publish(scamMessages)

                val token = userPreferences.userData.first().authToken
                if (token.isEmpty()) {
                    _state.value = _state.value.copy(matchingNote = "Sign in to see scam waves reported by others")
                    return@launch
                }
                backfillMatches(token, scamMessages)
            }
    }

    /**
     * Where tapping a campaign message should go. High-confidence scams
     * ("blocked") open their Smishing Alert, which needs the backend message
     * id; everything else opens the thread.
     *
     * A blocked scam with no backend id opens its thread too. The server
     * stores nothing for a sender it has already blocked, so those messages
     * never get an id -- this used to show "Connect to the server to open this
     * scam alert" on a perfectly good connection, for every message from a
     * blocked sender. The thread still shows them, marked as a likely scam.
     */
    fun resolveOpenTarget(
        message: LocalScamMessage,
        onResult: (OpenTarget) -> Unit,
    ) {
        if (message.classification != Classification.SCAM) {
            onResult(OpenTarget.Thread(message.sender))
            return
        }
        viewModelScope.launch {
            val token = userPreferences.userData.first().authToken
            val backendId =
                if (token.isEmpty()) {
                    null
                } else {
                    runCatching { SmsIngestPipeline.backendMessageIdFor(getApplication(), token, message.id) }
                        .getOrNull()
                }
            onResult(backendId?.let { OpenTarget.Alert(it) } ?: OpenTarget.Thread(message.sender))
        }
    }

    private suspend fun loadScamMessages(): List<SmsMessage> =
        withContext(Dispatchers.IO) {
            smsRepository.getInboxMessages().filter { !it.isOutgoing && it.classification in SCAM_CLASSIFICATIONS }
        }

    private suspend fun publish(scamMessages: List<SmsMessage>) {
        val matches = matchStore.snapshot()
        val overview =
            withContext(Dispatchers.Default) {
                buildLocalCampaigns(
                    scamMessages.map {
                        LocalScamMessage(it.id, it.sender, it.body, it.timestamp, matches[it.id], it.classification)
                    },
                )
            }
        _state.value = _state.value.copy(overview = overview, isLoading = false)
    }

    private suspend fun backfillMatches(
        token: String,
        scamMessages: List<SmsMessage>,
    ) {
        val known = matchStore.snapshot().keys
        val pending = scamMessages.filter { it.id !in known }.take(MAX_MATCH_BACKFILL)
        if (pending.isEmpty()) {
            _state.value = _state.value.copy(matchingProgress = null, matchingNote = null)
            return
        }

        var unavailable = false
        _state.value = _state.value.copy(matchingProgress = "Checking for new scam waves…")
        for (message in pending) {
            val outcome =
                runCatching { SmsIngestPipeline.classifyExisting(getApplication(), token, message) }
                    .onFailure { Log.w(TAG, "Campaign match failed for ${message.id}", it) }
                    .getOrNull()
            // classifyExisting already persists the verdict with truthful
            // provenance. A local verdict still means campaign matching was
            // unavailable, so stop the remote backfill and retain that note.
            if ((outcome !is SmsIngestPipeline.ScanOutcome.Classified || !outcome.matchedRemotely) &&
                outcome != SmsIngestPipeline.ScanOutcome.Skipped
            ) {
                unavailable = true
                break
            }
        }
        if (unavailable) {
            // Stop at the first outage instead of timing out on every message.
            _state.value =
                _state.value.copy(
                    matchingProgress = null,
                    matchingNote = "You're offline, so these groups come from this phone only",
                )
        } else {
            _state.value = _state.value.copy(matchingProgress = null, matchingNote = null)
        }
        publish(loadScamMessages())
    }
}
