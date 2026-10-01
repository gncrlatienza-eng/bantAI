package com.bantai.ui.screens.main

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.outlined.Block
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.data.model.AlertSection
import com.bantai.data.model.AlertTab
import com.bantai.data.model.REPORT_REJECTED
import com.bantai.data.model.REPORT_VALIDATED
import com.bantai.data.model.sectionAlerts
import com.bantai.data.model.tab
import com.bantai.data.model.unseenAlerts
import com.bantai.data.remote.SmsApi
import com.bantai.navigation.Screen
import com.bantai.ui.components.GroupedDivider
import com.bantai.ui.components.GroupedSectionHeader
import com.bantai.ui.components.ListSkeleton
import com.bantai.ui.components.StateMessage
import com.bantai.ui.components.groupedItem
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.IosBlue
import com.bantai.ui.theme.OnIndigo
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TabTitleTopSpacing
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White
import com.bantai.util.MessageTime
import com.bantai.viewmodel.AlertsViewModel
import kotlinx.coroutines.launch
import java.time.Instant

// Where a row's text column starts (4dp start + 14dp unseen-dot gutter + 24dp
// icon + 10dp gap); the inset hairlines line up with it, as in iOS lists.
private val ROW_TEXT_INSET = 52.dp

// Empty/error states fill this much of the list's height and center in it, so
// they sit in the visible middle rather than behind the floating tab bar.
private const val EMPTY_STATE_HEIGHT = 0.7f

/**
 * Alerts tab, as four pages picked with chips like the Messages tab's
 * filters (see AlertTab): To review, Reviewed, Reported, Blocked. Every alert
 * is on exactly one page, and a line under the chips says what the page is
 * for. Rows are grouped Today / This Week / Earlier; a blue dot and bold
 * sender mark alerts not opened yet, and a chip gets a dot when its page has
 * any, so the tab's count always leads somewhere. Seen/reviewed state is
 * phone-only (AlertStateStore); reports come from the backend.
 */
@Composable
fun AlertsScreen(
    navController: NavController,
    innerPadding: PaddingValues,
    viewModel: AlertsViewModel = viewModel(),
) {
    val alerts by viewModel.alerts.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val tab by viewModel.tab.collectAsState()
    val alertState by viewModel.alertState.collectAsState()

    val unseen =
        remember(alerts, alertState) {
            unseenAlerts(alerts, alertState.initialized, alertState.seen).map { it.messageId }.toSet()
        }
    val tabsWithNew =
        remember(alerts, unseen) {
            alerts.filter { it.messageId in unseen }.map { it.tab() }.toSet()
        }
    val sections = remember(alerts, tab) { sectionAlerts(alerts, tab) }

    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var pendingUnblock by remember { mutableStateOf<SmsApi.AlertSummary?>(null) }

    // Every alert routes to SmishingAlertScreen -- the alert-detail screen.
    fun onAlertClick(alert: SmsApi.AlertSummary) {
        viewModel.markSeen(alert)
        navController.navigate(Screen.SmishingAlert.createRoute(alert.messageId))
    }

    pendingUnblock?.let { alert ->
        UnblockDialog(
            sender = alert.sender.ifEmpty { stringResource(R.string.unknown_sender) },
            onConfirm = {
                pendingUnblock = null
                viewModel.unblockSender(alert) { synced ->
                    scope.launch {
                        snackbarHostState.currentSnackbarData?.dismiss()
                        snackbarHostState.showSnackbar(
                            if (synced) {
                                context.getString(R.string.alerts_unblocked, alert.sender)
                            } else {
                                context.getString(R.string.alerts_unblocked_not_synced)
                            },
                        )
                    }
                }
            },
            onDismiss = { pendingUnblock = null },
        )
    }

    Box(Modifier.fillMaxSize()) {
        // The title, chips and page description stay pinned while only the
        // list below scrolls. Rows sit in iOS inset-grouped cards (see
        // GroupedList.kt), one card per section, like Settings.
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(Black)
                    .statusBarsPadding(),
        ) {
            Spacer(Modifier.height(TabTitleTopSpacing))
            AlertsTitle(hasUnseen = unseen.isNotEmpty(), onMarkAllSeen = viewModel::markAllSeen)
            Spacer(Modifier.height(10.dp))
            AlertTabChips(selected = tab, tabsWithNew = tabsWithNew, onSelect = viewModel::setTab)
            Text(
                stringResource(tab.aboutRes()),
                color = TextSecondary,
                fontSize = TextSize.Footnote,
                lineHeight = 18.sp,
                modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 10.dp),
            )
            AlertsList(
                state = AlertsListState(isLoading, errorMessage, tab, sections, unseen),
                bottomPadding = innerPadding.calculateBottomPadding() + 24.dp,
                onClick = ::onAlertClick,
                onUnblock = { pendingUnblock = it },
                onRetry = { viewModel.loadAlerts() },
            )
        }
        SnackbarHost(
            hostState = snackbarHostState,
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = innerPadding.calculateBottomPadding()),
        )
    }
}

private data class AlertsListState(
    val isLoading: Boolean,
    val errorMessage: String?,
    val tab: AlertTab,
    val sections: List<AlertSection>,
    val unseen: Set<String>,
)

@Composable
private fun AlertsTitle(
    hasUnseen: Boolean,
    onMarkAllSeen: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            stringResource(R.string.alerts_title),
            color = White,
            fontWeight = FontWeight.Bold,
            fontSize = TextSize.LargeTitle,
            modifier = Modifier.weight(1f),
        )
        if (hasUnseen) {
            Text(
                stringResource(R.string.alerts_mark_all_read),
                color = IosBlue,
                fontSize = TextSize.Body,
                modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable(onClick = onMarkAllSeen).padding(8.dp),
            )
        }
    }
}

// Same chip style as the Messages tab's filters. No counts (they read as
// clutter); a blue dot marks a page holding alerts not opened yet.
@Composable
private fun AlertTabChips(
    selected: AlertTab,
    tabsWithNew: Set<AlertTab>,
    onSelect: (AlertTab) -> Unit,
) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 20.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(AlertTab.entries) { tab ->
            val isSelected = tab == selected
            val label = stringResource(tab.titleRes())
            val hasNew = tab in tabsWithNew
            val description = if (hasNew) stringResource(R.string.alerts_cd_tab_has_new, label) else label
            Row(
                modifier =
                    Modifier
                        .heightIn(min = 36.dp)
                        .clip(RoundedCornerShape(100.dp))
                        .background(if (isSelected) Indigo else SurfaceElevated)
                        .clickable { onSelect(tab) }
                        .padding(horizontal = 14.dp, vertical = 8.dp)
                        .semantics { contentDescription = description },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (hasNew) {
                    Box(Modifier.size(7.dp).background(if (isSelected) OnIndigo else IosBlue, CircleShape))
                    Spacer(Modifier.width(6.dp))
                }
                Text(
                    label,
                    color = if (isSelected) OnIndigo else White,
                    fontSize = TextSize.Subhead,
                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                )
            }
        }
    }
}

@Composable
private fun ColumnScope.AlertsList(
    state: AlertsListState,
    bottomPadding: Dp,
    onClick: (SmsApi.AlertSummary) -> Unit,
    onUnblock: (SmsApi.AlertSummary) -> Unit,
    onRetry: () -> Unit,
) {
    val errorMessage = state.errorMessage
    LazyColumn(
        modifier = Modifier.weight(1f).fillMaxWidth(),
        contentPadding = PaddingValues(bottom = bottomPadding),
    ) {
        when {
            state.isLoading ->
                item { ListSkeleton(rows = 5) }
            errorMessage != null ->
                item {
                    StateMessage(
                        icon = Icons.Outlined.CloudOff,
                        title = stringResource(R.string.alerts_load_failed),
                        detail = errorMessage,
                        actionLabel = stringResource(R.string.action_retry),
                        onAction = onRetry,
                        modifier = Modifier.fillParentMaxHeight(EMPTY_STATE_HEIGHT),
                    )
                }
            state.sections.isEmpty() ->
                item { EmptyAlerts(state.tab, Modifier.fillParentMaxHeight(EMPTY_STATE_HEIGHT)) }
            else ->
                state.sections.forEach { section ->
                    item { GroupedSectionHeader(section.title) }
                    alertRows(
                        tab = state.tab,
                        sectionAlerts = section.alerts,
                        unseen = state.unseen,
                        onClick = onClick,
                        onUnblock = onUnblock,
                    )
                }
        }
    }
}

private fun LazyListScope.alertRows(
    tab: AlertTab,
    sectionAlerts: List<SmsApi.AlertSummary>,
    unseen: Set<String>,
    onClick: (SmsApi.AlertSummary) -> Unit,
    onUnblock: (SmsApi.AlertSummary) -> Unit,
) {
    itemsIndexed(sectionAlerts, key = { _, alert -> alert.messageId }) { index, alert ->
        Column(Modifier.groupedItem(index, sectionAlerts.lastIndex)) {
            AlertRow(
                alert = alert,
                tab = tab,
                unseen = alert.messageId in unseen,
                onClick = { onClick(alert) },
                onUnblock = if (tab == AlertTab.BLOCKED) ({ onUnblock(alert) }) else null,
            )
            if (index != sectionAlerts.lastIndex) GroupedDivider(startInset = ROW_TEXT_INSET)
        }
    }
}

@Composable
private fun EmptyAlerts(
    tab: AlertTab,
    modifier: Modifier = Modifier,
) {
    val (title, detail) =
        when (tab) {
            AlertTab.TO_REVIEW -> R.string.alerts_empty_title to R.string.alerts_empty_detail
            AlertTab.BLOCKED -> R.string.alerts_empty_blocked_title to R.string.alerts_empty_blocked_detail
            AlertTab.REPORTED -> R.string.alerts_empty_reported_title to R.string.alerts_empty_reported_detail
        }
    StateMessage(
        icon = Icons.Outlined.VerifiedUser,
        iconTint = Safe,
        title = stringResource(title),
        detail = stringResource(detail),
        modifier = modifier,
    )
}

// Each page has its own glyph and color, so a row says where it belongs even
// out of context: orange warning to review, red block, indigo flag.
private data class RowStyle(
    val icon: ImageVector,
    val tint: Color,
    val label: Int,
)

@Composable
private fun AlertTab.rowStyle(): RowStyle =
    when (this) {
        AlertTab.TO_REVIEW -> RowStyle(Icons.Outlined.WarningAmber, Suspicious, R.string.alerts_needs_review)
        AlertTab.BLOCKED -> RowStyle(Icons.Outlined.Block, Danger, R.string.alerts_blocked)
        AlertTab.REPORTED -> RowStyle(Icons.Outlined.Flag, Indigo, R.string.alerts_tab_reported)
    }

@Composable
@Suppress("LongMethod") // icon + up to three text lines, kept together
private fun AlertRow(
    alert: SmsApi.AlertSummary,
    tab: AlertTab,
    unseen: Boolean,
    onClick: () -> Unit,
    onUnblock: (() -> Unit)? = null,
) {
    val style = tab.rowStyle()
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(start = 4.dp, end = 12.dp, top = 11.dp, bottom = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Unseen indicator -- the same blue dot the Messages tab uses for unread.
        Box(modifier = Modifier.width(14.dp), contentAlignment = Alignment.Center) {
            if (unseen) Box(Modifier.size(9.dp).background(IosBlue, CircleShape))
        }
        Box(modifier = Modifier.size(24.dp), contentAlignment = Alignment.Center) {
            Icon(
                style.icon,
                contentDescription = stringResource(style.label),
                tint = style.tint,
                modifier = Modifier.size(20.dp),
            )
        }
        Spacer(Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    alert.sender.ifEmpty { stringResource(R.string.unknown_sender) },
                    color = White,
                    // Bold until opened, like an unread mail.
                    fontWeight = if (unseen) FontWeight.Bold else FontWeight.SemiBold,
                    fontSize = TextSize.Body,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(8.dp))
                Text(formatAlertTime(alert.receivedAt), color = TextSecondary, fontSize = TextSize.Footnote)
                if (onUnblock != null) {
                    // A plain blue text action, like Mail's inline buttons --
                    // in place of the chevron, so the row stays one line.
                    Text(
                        stringResource(R.string.blocked_numbers_unblock),
                        color = IosBlue,
                        fontSize = TextSize.Subhead,
                        fontWeight = FontWeight.Medium,
                        modifier =
                            Modifier
                                .padding(start = 6.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .clickable(onClick = onUnblock)
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                    )
                } else {
                    Icon(
                        Icons.Default.ChevronRight,
                        contentDescription = null,
                        tint = TextTertiary,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
            Spacer(Modifier.height(2.dp))
            Text(
                alert.body,
                color = if (unseen) White else TextSecondary,
                fontSize = TextSize.Subhead,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            alert.report?.let { ReportStatusLine(it) }
        }
    }
}

// Unblocking a likely scammer deserves one confirmation; same wording as
// Blocked Numbers in Settings.
@Composable
private fun UnblockDialog(
    sender: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Surface,
        title = {
            Text(stringResource(R.string.blocked_numbers_unblock_number), color = White, fontWeight = FontWeight.Bold)
        },
        text = {
            Text(
                stringResource(R.string.blocked_numbers_unblock_detail, sender),
                color = TextSecondary,
                fontSize = TextSize.Footnote,
            )
        },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(stringResource(R.string.blocked_numbers_unblock), color = Indigo, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.action_cancel), color = TextSecondary)
            }
        },
    )
}

// "Reported as scam · Waiting for review": what the user said, and where it stands.
@Composable
private fun ReportStatusLine(report: SmsApi.AlertReport) {
    val (status, color) =
        when (report.status) {
            REPORT_VALIDATED -> R.string.alerts_report_accepted to Safe
            REPORT_REJECTED -> R.string.alerts_report_rejected to TextSecondary
            else -> R.string.alerts_report_pending to TextSecondary
        }
    Spacer(Modifier.height(3.dp))
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(stringResource(reportedAsRes(report.reportedLabel)), color = Indigo, fontSize = TextSize.Footnote)
        Text(" · ", color = TextTertiary, fontSize = TextSize.Footnote)
        Text(stringResource(status), color = color, fontSize = TextSize.Footnote, fontWeight = FontWeight.Medium)
    }
}

/** "Reported as scam/spam/safe" for a report's label (Scam/Spam/Ham). */
fun reportedAsRes(reportedLabel: String): Int =
    when (reportedLabel) {
        "Scam" -> R.string.alerts_reported_as_scam
        "Spam" -> R.string.alerts_reported_as_spam
        else -> R.string.alerts_reported_as_safe
    }

private fun AlertTab.titleRes(): Int =
    when (this) {
        AlertTab.TO_REVIEW -> R.string.alerts_tab_to_review
        AlertTab.BLOCKED -> R.string.alerts_tab_blocked
        AlertTab.REPORTED -> R.string.alerts_tab_reported
    }

private fun AlertTab.aboutRes(): Int =
    when (this) {
        AlertTab.TO_REVIEW -> R.string.alerts_about_to_review
        AlertTab.BLOCKED -> R.string.alerts_about_blocked
        AlertTab.REPORTED -> R.string.alerts_about_reported
    }

// Same labels as the Messages list ("2:14 PM", "Yesterday", "Mon", "Sep 12",
// "7/20/24"), so an inbox scan's years-old scams don't read as this year.
@Composable
private fun formatAlertTime(iso: String): String {
    val millis = runCatching { Instant.parse(iso).toEpochMilli() }.getOrNull() ?: return ""
    return MessageTime.listLabel(LocalContext.current, millis)
}
