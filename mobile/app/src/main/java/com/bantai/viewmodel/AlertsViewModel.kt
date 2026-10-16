package com.bantai.viewmodel

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.lifecycle.viewModelScope
import com.bantai.container
import com.bantai.data.AlertBlocking
import com.bantai.data.LocalScamAlerts
import com.bantai.data.local.AlertState
import com.bantai.data.localAlertsOnly
import com.bantai.data.model.AlertTab
import com.bantai.data.model.ReportFilter
import com.bantai.data.model.TODAY
import com.bantai.data.model.unseenAlerts
import com.bantai.data.model.visibleAlerts
import com.bantai.data.model.withLocalReports
import com.bantai.data.model.withReportList
import com.bantai.data.remote.ReportsApi
import com.bantai.data.remote.SmsApi
import com.bantai.data.remote.toUserMessage
import com.bantai.util.ContactNames
import com.bantai.util.NotificationHelper
import com.bantai.util.NotificationLanding
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.yield

// The newest page of alerts gets re-fetched on every tick (a full load pulls
// up to ALERTS_MAX_PAGES pages of 100 via the backend's cursor), so this trades
// alert-badge freshness against bandwidth/battery: long enough to not hammer
// the backend, short enough that a new threat still shows up promptly.
// Only while the Alerts tab is on screen; elsewhere the badge refreshes on the
// slower interval so low-end phones and weak signal aren't hit every 20s.
private const val ALERTS_POLL_INTERVAL_MS = 20_000L
private const val ALERTS_BACKGROUND_POLL_INTERVAL_MS = 60_000L
private const val ALERTS_MAX_PAGES = 5
private const val TAG = "AlertsViewModel"
private const val LOCAL_REFRESH_DEBOUNCE_MS = 500L

class AlertsViewModel(
    application: Application,
) : AndroidViewModel(application) {
    private val userPreferences = application.container.userPreferences
    private val smsRepository = application.container.smsRepository

    private val _alerts = MutableStateFlow<List<SmsApi.AlertSummary>>(emptyList())

    // The user's own reports (GET /reports/mine), on this phone. Reports on
    // texts the model called safe have no alert, so they only come from here.
    private val reportList = MutableStateFlow<List<SmsApi.AlertSummary>>(emptyList())

    // Scams only the on-device model caught (no server alert behind them).
    private val localAlerts = MutableStateFlow<List<SmsApi.AlertSummary>>(emptyList())

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private var loadJob: Job? = null

    private val alertStateStore = application.container.alertStateStore
    val alertState: StateFlow<AlertState> =
        alertStateStore.state.stateIn(viewModelScope, SharingStarted.Eagerly, AlertState())

    // Settings → Hide Unknown.
    private val hideUnknown = application.container.userPreferences.hideUnknown

    /**
     * The alerts plus every report the user filed, with reports just filed
     * from this phone already applied.
     */
    val alerts: StateFlow<List<SmsApi.AlertSummary>> =
        combine(_alerts, localAlerts, reportList, alertState, hideUnknown) { alerts, local, reports, state, hidden ->
            visibleAlerts(
                withLocalReports(withReportList(alerts + local, reports), state.reported),
                hideUnknown = hidden,
                nowMillis = System.currentTimeMillis(),
            )
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

    // To Review's Today / This Week / Earlier, kept like reportFilter.
    private val _ageFilter = MutableStateFlow(TODAY)
    val ageFilter: StateFlow<String> = _ageFilter.asStateFlow()

    fun setAgeFilter(bucket: String) {
        _ageFilter.value = bucket
    }

    /** Alerts the user hasn't opened yet -- drives the Alerts tab's count. */
    val unseenCount: StateFlow<Int> =
        combine(_alerts, localAlerts, alertState, hideUnknown) { alerts, local, state, hidden ->
            val shown = visibleAlerts(alerts + local, hideUnknown = hidden, nowMillis = System.currentTimeMillis())
            unseenAlerts(shown, state.initialized, state.seen).size
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

    // A tapped report-result notification opens the Reported page.
    init {
        viewModelScope.launch {
            // Let the rest of the constructor run first: launch is immediate on
            // Main, and this init sits above properties setFilter/setTab use.
            yield()
            NotificationLanding.pending.collect {
                if (NotificationLanding.consume(NotificationLanding.REPORTS)) _tab.value = AlertTab.REPORTED
            }
        }
    }

    fun setTab(tab: AlertTab) {
        _tab.value = tab
    }

    fun markSeen(alert: SmsApi.AlertSummary) {
        NotificationHelper.cancelAlert(getApplication(), alert.sender)
        viewModelScope.launch { alertStateStore.markSeen(alert.messageId) }
    }

    /** "Mark all read": clears every new dot and the tab count without opening each alert. */
    fun markAllSeen() {
        val all = _alerts.value + localAlerts.value
        all.map { it.sender }.distinct().forEach { NotificationHelper.cancelAlert(getApplication(), it) }
        viewModelScope.launch { alertStateStore.markSeen(all.map { it.messageId }) }
    }

    // Set by AlertsScreen while it's composed; picks the faster poll interval.
    @Volatile
    var isScreenVisible = false

    init {
        // What Alerts actually shows (not the raw server list: expired, blocked
        // or hidden-Unknown alerts aren't shown, so Unknown must keep them).
        viewModelScope.launch {
            alerts.collect { shown ->
                application.container.alertedMessageIds.value = shown.mapNotNullTo(HashSet()) { it.localId }
            }
        }
        loadAlerts()
        // A new verdict (on-device or from the server's AI), or a block/unblock
        // made from a thread, shows here right away instead of on the next
        // 20-60 s poll. A server-caught scam's alert lives on the server, so
        // this fetches the newest page too: it used to refresh only on-device
        // data, and a new scam stayed out of Alerts until its notification was
        // tapped or the app restarted.
        @OptIn(FlowPreview::class)
        viewModelScope.launch {
            combine(
                application.container.classificationStore.classifications,
                application.container.blockedSendersStore.state,
            ) { _, _ -> Unit }
                .drop(1)
                .debounce(LOCAL_REFRESH_DEBOUNCE_MS)
                .collect {
                    refreshLocalState()
                    loadAlerts(silent = true)
                }
        }
        // Signed out, or in again (this ViewModel outlives both): drop the last
        // session's alerts and its "Sign in to see alerts" error, then load fresh.
        viewModelScope.launch {
            userPreferences.userData
                .map { it.authToken }
                .distinctUntilChanged()
                .drop(1)
                .collect {
                    _alerts.value = emptyList()
                    reportList.value = emptyList()
                    localAlerts.value = emptyList()
                    _errorMessage.value = null
                    loadAlerts()
                }
        }
        // Back from the background (or the screen turned on): catch up now,
        // not on the next poll tick.
        viewModelScope.launch {
            ProcessLifecycleOwner
                .get()
                .lifecycle.currentStateFlow
                .drop(1)
                .collect { state -> if (state == Lifecycle.State.STARTED) loadAlerts(silent = true) }
        }
        // Polling lives here (viewModelScope) rather than in AlertsScreen's own
        // composition, so the Alerts tab's unread badge stays live even while
        // the user is on a different tab — not just while this screen itself
        // happens to be on screen.
        viewModelScope.launch {
            while (isActive) {
                delay(if (isScreenVisible) ALERTS_POLL_INTERVAL_MS else ALERTS_BACKGROUND_POLL_INTERVAL_MS)
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
        // A background refresh never interrupts a load in flight: cancelling a
        // full load left the spinner up for good (isLoading is only cleared by
        // the load itself), and the running load brings the same news anyway.
        if (silent && loadJob?.isActive == true) {
            // ...but runs once more after it: the running request may predate the
            // alert that triggered this (a new verdict), and dropping it left the
            // scam out of Alerts until the next 20-60 s poll.
            refreshAgain = true
            return
        }
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
                    // On-device scams need no account.
                    refreshLocalAlerts(token)
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
                refreshLocalAlerts(token)
                if (!silent) _isLoading.value = false
                if (refreshAgain) {
                    refreshAgain = false
                    // This job is finishing: detach it so the re-run isn't
                    // mistaken for a load still in flight.
                    loadJob = null
                    loadAlerts(silent = true)
                }
            }
    }

    @Volatile private var refreshAgain = false

    // The container outlives this ViewModel: don't leave this session's ids
    // hiding messages from Unknown after it's gone (sign-out pops Main).
    override fun onCleared() {
        getApplication<Application>().container.alertedMessageIds.value = emptySet()
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

    private suspend fun refreshLocalState() {
        val token = userPreferences.userData.first().authToken
        val server = _alerts.value
        if (server.isNotEmpty()) {
            _alerts.value = AlertBlocking.withBlockStatus(getApplication(), token, server, catchUp = false)
        }
        refreshLocalAlerts(token)
    }

    // Best-effort, like reports: a failure keeps the last list.
    @Suppress("TooGenericExceptionCaught")
    private suspend fun refreshLocalAlerts(token: String) {
        try {
            val shown = (_alerts.value + reportList.value).mapNotNullTo(HashSet()) { it.localId }
            val found = LocalScamAlerts.load(getApplication(), shown)
            val blocked = AlertBlocking.withBlockStatus(getApplication(), token, found, catchUp = false)
            localAlerts.value = withContext(Dispatchers.IO) { withSenderNames(blocked) }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            Log.w(TAG, "Failed to load on-device scam alerts", e)
        }
    }

    // "kryshan" rather than "+639157786474", same as the Messages list.
    private fun withSenderNames(alerts: List<SmsApi.AlertSummary>): List<SmsApi.AlertSummary> {
        val context = getApplication<Application>()
        return alerts.map { it.copy(senderName = ContactNames.lookup(context, it.sender)) }
    }
}
