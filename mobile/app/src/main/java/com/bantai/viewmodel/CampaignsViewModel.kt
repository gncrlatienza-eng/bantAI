package com.bantai.viewmodel

import android.app.Application
import android.util.Log
import androidx.compose.runtime.mutableStateMapOf
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.data.SmsIngestPipeline
import com.bantai.data.SmsRepository
import com.bantai.data.local.CampaignMatchStore
import com.bantai.data.local.ClassificationStore
import com.bantai.data.local.UserPreferences
import com.bantai.data.model.LocalCampaignOverview
import com.bantai.data.model.LocalScamMessage
import com.bantai.data.model.SmsMessage
import com.bantai.data.model.buildLocalCampaigns
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private const val TAG = "CampaignsViewModel"

// Messages this phone treats as scam or suspicious (see routeServerClassification
// / applyOfflineCaution). Spam is promotional and deliberately left out.
private val SCAM_CLASSIFICATIONS = setOf("blocked", "unknown")

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

    /** A blocked scam whose alert can't be looked up (offline or signed out). */
    data object Unavailable : OpenTarget
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
    private val userPreferences = UserPreferences(application)
    private val smsRepository = SmsRepository(application)
    private val matchStore = CampaignMatchStore(application)
    private val classificationStore = ClassificationStore(application)

    private val _state = MutableStateFlow(CampaignsUiState())
    val state: StateFlow<CampaignsUiState> = _state.asStateFlow()

    private var loadJob: Job? = null

    /**
     * Which campaign rows are open, keyed by LocalCampaign.key (plus
     * "unmatched"). Kept here rather than in the screen so opening a message
     * and coming back finds the same rows still open.
     */
    val expanded = mutableStateMapOf<String, Boolean>()

    init {
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
                    _state.value = _state.value.copy(matchingNote = "Sign in to match known campaigns")
                    return@launch
                }
                backfillMatches(token, scamMessages)
            }
    }

    /**
     * Where tapping a campaign message should go. High-confidence scams
     * ("blocked") are deliberately hidden from conversation threads and live
     * only as alerts, so they open the Smishing Alert screen, which needs the
     * backend message id; everything else opens the thread.
     */
    fun resolveOpenTarget(
        message: LocalScamMessage,
        onResult: (OpenTarget) -> Unit,
    ) {
        if (message.classification != "blocked") {
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
            onResult(backendId?.let { OpenTarget.Alert(it) } ?: OpenTarget.Unavailable)
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
        for ((index, message) in pending.withIndex()) {
            _state.value = _state.value.copy(matchingProgress = "Matching ${index + 1} of ${pending.size} messages…")
            val outcome =
                runCatching { SmsIngestPipeline.classifyExisting(getApplication(), token, message) }
                    .onFailure { Log.w(TAG, "Campaign match failed for ${message.id}", it) }
                    .getOrNull()
            if (outcome is SmsIngestPipeline.ScanOutcome.Classified) {
                classificationStore.setClassification(message.id, outcome.classification)
            } else if (outcome != SmsIngestPipeline.ScanOutcome.Skipped) {
                unavailable = true
                break
            }
        }
        if (unavailable) {
            // Stop at the first outage instead of timing out on every message.
            _state.value =
                _state.value.copy(
                    matchingProgress = null,
                    matchingNote = "Couldn't reach the server, so these groups come from this phone only",
                )
        } else {
            _state.value = _state.value.copy(matchingProgress = null, matchingNote = null)
        }
        publish(loadScamMessages())
    }
}
