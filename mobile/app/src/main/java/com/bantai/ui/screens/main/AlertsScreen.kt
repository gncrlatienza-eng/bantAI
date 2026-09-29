package com.bantai.ui.screens.main

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Undo
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.outlined.Block
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.data.model.AlertFilter
import com.bantai.data.model.AlertKind
import com.bantai.data.model.AlertSection
import com.bantai.data.model.kind
import com.bantai.data.model.sectionAlerts
import com.bantai.data.remote.SmsApi
import com.bantai.navigation.Screen
import com.bantai.ui.components.ListSkeleton
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.IosBlue
import com.bantai.ui.theme.OnAccent
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.SystemGray
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White
import com.bantai.viewmodel.AlertsViewModel
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

// Where a row's text column starts (8dp start + 12dp unseen-dot gutter + 36dp
// icon + 12dp gap); the inset hairlines line up with it, as in iOS lists.
private val ROW_TEXT_INSET = 68.dp

/**
 * Alerts tab. What needs a decision comes first ("Needs Review": suspicious
 * texts BantAI didn't block, including scam-like texts from trusted senders),
 * then the history -- scams already blocked, and alerts the user swiped away
 * as reviewed -- grouped Today / This Week / Earlier. A filter narrows it to
 * one kind; a blue dot marks alerts not opened yet. Seen/reviewed state is
 * phone-only (AlertStateStore).
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
    val filter by viewModel.filter.collectAsState()
    val alertState by viewModel.alertState.collectAsState()

    val sections = remember(alerts, filter, alertState.reviewed) { sectionAlerts(alerts, filter, alertState.reviewed) }
    val pendingCount = alerts.count { it.kind() == AlertKind.NEEDS_REVIEW && it.messageId !in alertState.reviewed }
    val blockedCount = alerts.count { it.kind() == AlertKind.BLOCKED }

    // Every alert routes to SmishingAlertScreen -- the alert-detail screen.
    fun onAlertClick(alert: SmsApi.AlertSummary) {
        viewModel.markSeen(alert)
        navController.navigate(Screen.SmishingAlert.createRoute(alert.messageId))
    }

    // Same layout as the Messages tab: the title, summary and filter stay
    // pinned while only the list below scrolls. The list is plain full-width
    // rows with inset hairlines, like iOS Mail.
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black)
                .statusBarsPadding(),
    ) {
        Spacer(Modifier.height(16.dp))
        AlertsHeader(
            filter = filter,
            pendingCount = pendingCount,
            blockedCount = blockedCount,
            onSelectFilter = viewModel::setFilter,
        )
        Spacer(Modifier.height(4.dp))
        AlertsList(
            state = AlertsListState(isLoading, errorMessage, sections, alertState.seen, alertState.reviewed),
            bottomPadding = innerPadding.calculateBottomPadding() + 24.dp,
            filter = filter,
            onClick = ::onAlertClick,
            onSetReviewed = viewModel::setReviewed,
        )
    }
}

private data class AlertsListState(
    val isLoading: Boolean,
    val errorMessage: String?,
    val sections: List<AlertSection>,
    val seen: Set<String>,
    val reviewed: Set<String>,
)

@Composable
private fun ColumnScope.AlertsList(
    state: AlertsListState,
    bottomPadding: Dp,
    filter: AlertFilter,
    onClick: (SmsApi.AlertSummary) -> Unit,
    onSetReviewed: (SmsApi.AlertSummary, Boolean) -> Unit,
) {
    val errorMessage = state.errorMessage
    val sections = state.sections
    LazyColumn(
        modifier = Modifier.weight(1f).fillMaxWidth(),
        contentPadding = PaddingValues(bottom = bottomPadding),
    ) {
        when {
            state.isLoading ->
                item { ListSkeleton(rows = 5) }
            errorMessage != null ->
                item {
                    Text(
                        errorMessage ?: "Could not load alerts",
                        color = Danger,
                        fontSize = TextSize.Footnote,
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 16.dp),
                    )
                }
            sections.isEmpty() ->
                item { EmptyAlerts(filter, Modifier.fillParentMaxSize()) }
            else ->
                sections.forEach { section ->
                    item { SectionHeader(section.title) }
                    alertRows(
                        sectionAlerts = section.alerts,
                        seen = state.seen,
                        reviewed = state.reviewed,
                        onClick = onClick,
                        onSetReviewed = onSetReviewed,
                    )
                }
        }
    }
}

@Composable
private fun AlertsHeader(
    filter: AlertFilter,
    pendingCount: Int,
    blockedCount: Int,
    onSelectFilter: (AlertFilter) -> Unit,
) {
    Column(modifier = Modifier.padding(horizontal = 20.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                filter.title,
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = TextSize.LargeTitle,
                modifier = Modifier.weight(1f),
            )
            AlertFilterButton(selected = filter, onSelect = onSelectFilter)
        }
        Spacer(Modifier.height(4.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier =
                    Modifier
                        .size(7.dp)
                        .background(if (pendingCount == 0) Safe else Suspicious, CircleShape),
            )
            Spacer(Modifier.width(6.dp))
            Text(summaryLine(pendingCount, blockedCount), color = TextSecondary, fontSize = TextSize.Subhead)
        }
    }
}

private fun summaryLine(
    pendingCount: Int,
    blockedCount: Int,
): String {
    val review =
        when (pendingCount) {
            0 -> "Nothing to review"
            1 -> "1 needs review"
            else -> "$pendingCount need review"
        }
    return if (blockedCount == 0) review else "$review · $blockedCount blocked"
}

// Same round glass button + check-marked menu as the Messages tab's filter.
@Composable
private fun AlertFilterButton(
    selected: AlertFilter,
    onSelect: (AlertFilter) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        Box(
            modifier =
                Modifier
                    .size(38.dp)
                    .background(White.copy(alpha = 0.08f), CircleShape)
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = { expanded = true },
                    ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Filled.FilterList,
                contentDescription = "Filter alerts",
                tint = White,
                modifier = Modifier.size(18.dp),
            )
        }
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            containerColor = SurfaceElevated,
            shape = RoundedCornerShape(14.dp),
        ) {
            AlertFilter.entries.forEach { option ->
                DropdownMenuItem(
                    text = {
                        Text(
                            option.title,
                            color = White,
                            fontSize = TextSize.Body,
                            fontWeight = if (option == selected) FontWeight.SemiBold else FontWeight.Normal,
                        )
                    },
                    trailingIcon = {
                        if (option == selected) {
                            Icon(
                                Icons.Filled.Check,
                                contentDescription = null,
                                tint = IosBlue,
                                modifier = Modifier.size(18.dp),
                            )
                        }
                    },
                    onClick = {
                        expanded = false
                        onSelect(option)
                    },
                )
            }
        }
    }
}

private fun LazyListScope.alertRows(
    sectionAlerts: List<SmsApi.AlertSummary>,
    seen: Set<String>,
    reviewed: Set<String>,
    onClick: (SmsApi.AlertSummary) -> Unit,
    onSetReviewed: (SmsApi.AlertSummary, Boolean) -> Unit,
) {
    itemsIndexed(sectionAlerts) { index, alert ->
        val isReviewed = alert.messageId in reviewed
        val row: @Composable () -> Unit = {
            AlertRow(
                alert = alert,
                unseen = alert.messageId !in seen,
                reviewed = isReviewed,
                onClick = { onClick(alert) },
            )
        }
        // Only alerts that need a decision can be swiped to reviewed (and a
        // reviewed one swiped back); a blocked scam has nothing to decide.
        if (alert.kind() == AlertKind.NEEDS_REVIEW) {
            SwipeToReview(isReviewed = isReviewed, onSwiped = { onSetReviewed(alert, !isReviewed) }, content = row)
        } else {
            row()
        }
        if (index != sectionAlerts.lastIndex) {
            HorizontalDivider(color = Hairline, thickness = 0.5.dp, modifier = Modifier.padding(start = ROW_TEXT_INSET))
        }
    }
}

// Swipe left to mark reviewed (or back to "needs review"), like archiving in
// iOS Mail. The row springs back and moves to its new section.
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SwipeToReview(
    isReviewed: Boolean,
    onSwiped: () -> Unit,
    content: @Composable () -> Unit,
) {
    val currentOnSwiped by rememberUpdatedState(onSwiped)
    val state =
        rememberSwipeToDismissBoxState(
            confirmValueChange = { value ->
                if (value == SwipeToDismissBoxValue.EndToStart) currentOnSwiped()
                false
            },
        )
    val actionColor = if (isReviewed) SystemGray else Safe
    SwipeToDismissBox(
        state = state,
        enableDismissFromStartToEnd = false,
        backgroundContent = {
            Row(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(actionColor)
                        .padding(horizontal = 20.dp),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    if (isReviewed) Icons.AutoMirrored.Outlined.Undo else Icons.Outlined.CheckCircle,
                    contentDescription = null,
                    tint = OnAccent,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    if (isReviewed) "Needs review" else "Reviewed",
                    color = OnAccent,
                    fontSize = TextSize.Subhead,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        },
    ) {
        Box(Modifier.background(Black)) { content() }
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        title,
        color = White,
        fontSize = TextSize.Body,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 20.dp, bottom = 4.dp),
    )
}

@Composable
private fun EmptyAlerts(
    filter: AlertFilter,
    modifier: Modifier = Modifier,
) {
    val (title, detail) =
        when (filter) {
            AlertFilter.ALL ->
                "You're all clear" to "Suspicious messages BantAI didn't block will show up here for you to review."
            AlertFilter.BLOCKED ->
                "No blocked scams" to "Scams BantAI stops automatically will be listed here."
        }
    Column(
        modifier = modifier.padding(horizontal = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(Icons.Outlined.VerifiedUser, contentDescription = null, tint = Safe, modifier = Modifier.size(40.dp))
        Spacer(Modifier.height(12.dp))
        Text(title, color = White, fontWeight = FontWeight.SemiBold, fontSize = TextSize.Headline)
        Spacer(Modifier.height(4.dp))
        Text(detail, color = TextSecondary, fontSize = TextSize.Subhead, textAlign = TextAlign.Center)
    }
}

@Composable
@Suppress("LongMethod") // icon + two text lines, kept together
private fun AlertRow(
    alert: SmsApi.AlertSummary,
    unseen: Boolean,
    reviewed: Boolean,
    onClick: () -> Unit,
) {
    val blocked = alert.kind() == AlertKind.BLOCKED
    val accent =
        when {
            blocked -> Danger
            reviewed -> SystemGray
            else -> Suspicious
        }

    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(start = 8.dp, end = 14.dp, top = 10.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Unseen indicator -- the same blue dot the Messages tab uses for unread.
        Box(modifier = Modifier.width(12.dp), contentAlignment = Alignment.Center) {
            if (unseen) Box(Modifier.size(8.dp).background(IosBlue, CircleShape))
        }
        Box(
            modifier =
                Modifier
                    .size(36.dp)
                    .background(accent.copy(alpha = 0.14f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                when {
                    blocked -> Icons.Outlined.Block
                    reviewed -> Icons.Outlined.CheckCircle
                    else -> Icons.Outlined.WarningAmber
                },
                contentDescription =
                    when {
                        blocked -> "Blocked"
                        reviewed -> "Reviewed"
                        else -> "Needs review"
                    },
                tint = accent,
                modifier = Modifier.size(18.dp),
            )
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    alert.sender.ifEmpty { "Unknown sender" },
                    color = White,
                    fontWeight = FontWeight.Bold,
                    fontSize = TextSize.Body,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(8.dp))
                Text(formatAlertTime(alert.receivedAt), color = TextSecondary, fontSize = TextSize.Footnote)
                Icon(
                    Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint = TextTertiary,
                    modifier = Modifier.size(16.dp),
                )
            }
            Spacer(Modifier.height(2.dp))
            Text(
                alert.body,
                color = TextSecondary,
                fontSize = TextSize.Subhead,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

private fun formatAlertTime(iso: String): String =
    try {
        val zoned = Instant.parse(iso).atZone(ZoneId.systemDefault())
        if (zoned.toLocalDate() == ZonedDateTime.now().toLocalDate()) {
            // Locale.US pinned, not device default — the app has no localized string
            // resources yet, so a localized date/time next to hardcoded English labels
            // would look more inconsistent, not less.
            zoned.format(DateTimeFormatter.ofPattern("h:mm a", Locale.US))
        } else {
            zoned.format(DateTimeFormatter.ofPattern("MMM d", Locale.US))
        }
    } catch (_: Exception) {
        ""
    }
