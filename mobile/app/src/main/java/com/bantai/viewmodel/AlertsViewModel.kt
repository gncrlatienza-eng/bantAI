package com.bantai.viewmodel

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.lifecycle.viewModelScope
import com.bantai.container
import com.bantai.data.AlertBlocking
import com.bantai.data.local.AlertState
import com.bantai.data.localAlertsOnly
import com.bantai.data.model.AlertTab
import com.bantai.data.model.unseenAlerts
import com.bantai.data.model.withLocalReports
import com.bantai.data.remote.SmsApi
import com.bantai.data.remote.toUserMessage
import com.bantai.util.BlockHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

// The whole (unbounded, per WBS -- the backend has no pagination on this
// endpoint yet) alert list gets re-fetched on every tick, so this trades
// alert-badge freshness against bandwidth/battery: long enough to not hammer
// the backend, short enough that a new threat still shows up promptly.
private const val ALERTS_POLL_INTERVAL_MS = 20_000L
private const val TAG = "AlertsViewModel"

class AlertsViewModel(
    application: Application,
) : AndroidViewModel(application) {
    private val userPreferences = application.container.userPreferences
    private val smsRepository = application.container.smsRepository

    private val _alerts = MutableStateFlow<List<SmsApi.AlertSummary>>(emptyList())

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private var loadJob: Job? = null

    private val alertStateStore = application.container.alertStateStore
    val alertState: StateFlow<AlertState> =
        alertStateStore.state.stateIn(viewModelScope, SharingStarted.Eagerly, AlertState())

    /** The alerts, with reports just filed from this phone already applied. */
    val alerts: StateFlow<List<SmsApi.AlertSummary>> =
        combine(_alerts, alertState) { alerts, state -> withLocalReports(alerts, state.reported) }
            .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    private val _tab = MutableStateFlow(AlertTab.TO_REVIEW)
    val tab: StateFlow<AlertTab> = _tab.asStateFlow()

    /** Alerts the user hasn't opened yet -- drives the Alerts tab's count. */
    val unseenCount: StateFlow<Int> =
        combine(_alerts, alertState) { alerts, state ->
            unseenAlerts(alerts, state.initialized, state.seen).size
        }.stateIn(viewModelScope, SharingStarted.Eagerly, 0)

    fun setTab(tab: AlertTab) {
        _tab.value = tab
    }

    fun markSeen(alert: SmsApi.AlertSummary) {
        viewModelScope.launch { alertStateStore.markSeen(alert.messageId) }
    }

    /** "Mark all read": clears every new dot and the tab count without opening each alert. */
    fun markAllSeen() {
        val ids = _alerts.value.map { it.messageId }
        viewModelScope.launch { alertStateStore.markSeen(ids) }
    }

    /**
     * Unblocks [alert]'s sender from the Blocked page. Its alerts move to To
     * review straight away (the next poll agrees: BlockedSendersStore now
     * records the sender as user-unblocked, so catch-up won't re-block it).
     * [onDone] gets false when only the phone half worked -- the backend may
     * still be filtering this sender.
     */
    fun unblockSender(
        alert: SmsApi.AlertSummary,
        onDone: (synced: Boolean) -> Unit,
    ) {
        viewModelScope.launch {
            val token = userPreferences.userData.first().authToken
            val synced = BlockHelper.unblockSender(getApplication(), token, alert.sender)
            _alerts.update { alerts ->
                alerts.map { if (it.sender == alert.sender) it.copy(senderBlocked = false) else it }
            }
            onDone(synced)
        }
    }

    init {
        loadAlerts()
        // Polling lives here (viewModelScope) rather than in AlertsScreen's own
        // composition, so the Alerts tab's unread badge stays live even while
        // the user is on a different tab — not just while this screen itself
        // happens to be on screen.
        viewModelScope.launch {
            while (isActive) {
                delay(ALERTS_POLL_INTERVAL_MS)
                // Skip while the app is backgrounded -- this ViewModel is scoped to
                // MainScreen's back stack entry (see AlertsScreen.kt), not to Activity
                // foreground state, so without this it keeps polling indefinitely even
                // while nothing is on screen to show the refreshed badge.
                val isForeground =
                    ProcessLifecycleOwner
                        .get()
                        .lifecycle.currentState
                        .isAtLeast(Lifecycle.State.STARTED)
                if (isForeground) {
                    loadAlerts(silent = true)
                }
            }
        }
    }

    /**
     * @param silent true for background polling refreshes — skips the loading
     *   spinner so an already-populated list doesn't flash empty every poll.
     */
    fun loadAlerts(silent: Boolean = false) {
        // Cancels any in-flight fetch first so a slow earlier response can't land
        // after a newer one and overwrite it with stale data.
        loadJob?.cancel()
        loadJob =
            viewModelScope.launch {
                if (!silent) {
                    _isLoading.value = true
                    _errorMessage.value = null
                }

                val token = userPreferences.userData.first().authToken
                if (token.isEmpty()) {
                    _isLoading.value = false
                    _errorMessage.value = "Sign in to see alerts"
                    return@launch
                }

                SmsApi
                    .getAlerts(token)
                    .onSuccess { alerts ->
                        // Alerts are smishing only; an older backend still returns the
                        // legacy promo alerts it created for every model Spam.
                        val smishing = alerts.filter { it.bucket != "spam" }
                        // Only alerts whose SMS is on this phone: others (another
                        // device on the same account, deleted SMS) can't be shown
                        // or acted on here.
                        val resolved = withContext(Dispatchers.IO) { smsRepository.localAlertsOnly(smishing) }
                        val local = AlertBlocking.withBlockStatus(getApplication(), token, resolved, catchUp = true)
                        alertStateStore.initializeIfNeeded(local.map { it.messageId })
                        _alerts.value = local
                        _errorMessage.value = null
                    }.onFailure { error ->
                        Log.w(TAG, "Failed to load alerts", error)
                        // A silent poll used to clear the error first and then fail
                        // quietly, so a persistent failure read as "No alerts yet".
                        // Keep showing already-loaded alerts, but never an empty
                        // list that hides the failure.
                        if (!silent || _alerts.value.isEmpty()) {
                            _errorMessage.value = error.toUserMessage("Could not reach the server")
                        }
                    }
                if (!silent) _isLoading.value = false
            }
    }
}
