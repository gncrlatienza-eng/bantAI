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
import com.bantai.data.model.ReportFilter
import com.bantai.data.model.unseenAlerts
import com.bantai.data.model.withLocalReports
import com.bantai.data.model.withReportList
import com.bantai.data.remote.ReportsApi
import com.bantai.data.remote.SmsApi
import com.bantai.data.remote.toUserMessage
import com.bantai.util.ContactNames
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
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

// The newest page of alerts gets re-fetched on every tick (a full load pulls
// up to ALERTS_MAX_PAGES pages of 100 via the backend's cursor), so this trades
// alert-badge freshness against bandwidth/battery: long enough to not hammer
// the backend, short enough that a new threat still shows up promptly.
private const val ALERTS_POLL_INTERVAL_MS = 20_000L
private const val ALERTS_MAX_PAGES = 5
private const val TAG = "AlertsViewModel"

class AlertsViewModel(
    application: Application,
) : AndroidViewModel(application) {
    private val userPreferences = application.container.userPreferences
    private val smsRepository = application.container.smsRepository

    private val _alerts = MutableStateFlow<List<SmsApi.AlertSummary>>(emptyList())

    // The user's own reports (GET /reports/mine), on this phone. Reports on
    // texts the model called safe have no alert, so they only come from here.
    private val reportList = MutableStateFlow<List<SmsApi.AlertSummary>>(emptyList())

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private var loadJob: Job? = null

    private val alertStateStore = application.container.alertStateStore
    val alertState: StateFlow<AlertState> =
        alertStateStore.state.stateIn(viewModelScope, SharingStarted.Eagerly, AlertState())

    /**
     * The alerts plus every report the user filed, with reports just filed
     * from this phone already applied.
     */
    val alerts: StateFlow<List<SmsApi.AlertSummary>> =
        combine(_alerts, reportList, alertState) { alerts, reports, state ->
            withLocalReports(withReportList(alerts, reports), state.reported)
        }.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    private val _tab = MutableStateFlow(AlertTab.TO_REVIEW)
    val tab: StateFlow<AlertTab> = _tab.asStateFlow()

    // Reported's status filter. Here rather than in the screen so it's kept
    // while a report (or a sender's reports) is open and on the way back.
    private val _reportFilter = MutableStateFlow(ReportFilter.WAITING)
    val reportFilter: StateFlow<ReportFilter> = _reportFilter.asStateFlow()

    fun setReportFilter(filter: ReportFilter) {
        _reportFilter.value = filter
    }

    /** Alerts the user hasn't opened yet -- drives the Alerts tab's count. */
    val unseenCount: StateFlow<Int> =
        combine(_alerts, alertState) { alerts, state ->
            unseenAlerts(alerts, state.initialized, state.seen).size
        }.stateIn(viewModelScope, SharingStarted.Eagerly, 0)

    // Keeps alerts older than a polled first page (loaded by an earlier full
    // load) instead of dropping them every 20s. ISO-8601 UTC strings from the
    // backend compare correctly as text.
    private fun withOlderAlerts(
        fresh: List<SmsApi.AlertSummary>,
        fetched: List<SmsApi.AlertSummary>,
    ): List<SmsApi.AlertSummary> {
        val oldest = fetched.lastOrNull()?.createdAt
        if (oldest == null || fetched.size < SmsApi.ALERTS_PAGE_SIZE) return fresh
        val ids = fresh.mapTo(HashSet()) { it.id }
        return fresh + _alerts.value.filter { it.id !in ids && it.createdAt < oldest }
    }

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

                // A background poll only needs the newest page; older pages
                // from the last full load are kept below.
                SmsApi
                    .getAlerts(token, maxPages = if (silent) 1 else ALERTS_MAX_PAGES)
                    .onSuccess { alerts ->
                        // Alerts are smishing only; an older backend still returns the
                        // legacy promo alerts it created for every model Spam.
                        val smishing = alerts.filter { it.bucket != "spam" }
                        // Only alerts whose SMS is on this phone: others (another
                        // device on the same account, deleted SMS) can't be shown
                        // or acted on here.
                        val resolved = withContext(Dispatchers.IO) { smsRepository.localAlertsOnly(smishing) }
                        val blocked = AlertBlocking.withBlockStatus(getApplication(), token, resolved, catchUp = true)
                        val local = withContext(Dispatchers.IO) { withSenderNames(blocked) }
                        alertStateStore.initializeIfNeeded(local.map { it.messageId })
                        _alerts.value = if (silent) withOlderAlerts(local, alerts) else local
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
                loadReports(token)
                if (!silent) _isLoading.value = false
            }
    }

    // Best-effort: a failure keeps the last list (reports still show from the
    // alerts that carry them), so it never replaces the alerts' error state.
    private suspend fun loadReports(token: String) {
        ReportsApi
            .mine(token)
            .onSuccess { reports ->
                val resolved = withContext(Dispatchers.IO) { smsRepository.localAlertsOnly(reports) }
                val blocked = AlertBlocking.withBlockStatus(getApplication(), token, resolved, catchUp = false)
                val local = withContext(Dispatchers.IO) { withSenderNames(blocked) }
                // A report is something the user did, never news to them: no
                // "new" dot for reports made before this list existed.
                alertStateStore.markSeen(local.map { it.messageId })
                alertStateStore.markReportedLocal(
                    local
                        .mapNotNull { report ->
                            val localId = report.localId ?: return@mapNotNull null
                            report.report?.let { localId to it.reportedLabel }
                        }.toMap(),
                )
                reportList.value = local
            }.onFailure { error -> Log.w(TAG, "Failed to load reports", error) }
    }

    // "kryshan" rather than "+639157786474", same as the Messages list.
    private fun withSenderNames(alerts: List<SmsApi.AlertSummary>): List<SmsApi.AlertSummary> {
        val context = getApplication<Application>()
        return alerts.map { it.copy(senderName = ContactNames.lookup(context, it.sender)) }
    }
}
