package com.bantai.ui.screens.main

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.outlined.Inbox
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.data.model.filter
import com.bantai.data.model.groupReports
import com.bantai.data.model.reportKey
import com.bantai.data.model.senderKey
import com.bantai.data.remote.SmsApi
import com.bantai.navigation.Screen
import com.bantai.navigation.rememberSafePopBack
import com.bantai.ui.components.GroupedDivider
import com.bantai.ui.components.GroupedSectionHeader
import com.bantai.ui.components.LocalBottomBarClearance
import com.bantai.ui.components.ReportStatusLine
import com.bantai.ui.components.SenderAvatar
import com.bantai.ui.components.StateMessage
import com.bantai.ui.components.groupedItem
import com.bantai.ui.components.reportReview
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White
import com.bantai.viewmodel.AlertsViewModel

/**
 * Every report about one sender under the Reported filter in use (Waiting,
 * Accepted or Declined), newest first -- what a "3 reports" row opens.
 * Each row is one report and opens its report page.
 */
@Composable
fun SenderReportsScreen(
    senderKey: String,
    navController: NavController,
    alertsViewModel: AlertsViewModel,
) {
    val alerts by alertsViewModel.alerts.collectAsState()
    val filter by alertsViewModel.reportFilter.collectAsState()
    val reports =
        remember(alerts, filter, senderKey) {
            groupReports(
                alerts
                    .filter { it.report?.filter() == filter && senderKey(it) == senderKey }
                    .sortedByDescending { it.receivedAt },
            )
        }
    val popBack = rememberSafePopBack(navController)

    Column(modifier = Modifier.fillMaxSize().background(Black)) {
        DetailBackRow(popBack)
        val latest = reports.firstOrNull()?.first()
        val report = latest?.report
        if (latest == null || report == null) {
            StateMessage(icon = Icons.Outlined.Inbox, title = stringResource(R.string.report_detail_gone))
            return@Column
        }
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = LocalBottomBarClearance.current),
        ) {
            item { SenderReportsHeader(latest, report, reports.size) }
            item { GroupedSectionHeader(stringResource(R.string.reports_sender_list)) }
            itemsIndexed(reports, key = { _, group -> reportKey(group.first()) }) { index, group ->
                Column(Modifier.groupedItem(index, reports.lastIndex)) {
                    SenderReportRow(group) {
                        navController.navigate(Screen.ReportDetail.createRoute(reportKey(group.first())))
                    }
                    if (index != reports.lastIndex) GroupedDivider(startInset = 16.dp)
                }
            }
        }
    }
}

// Avatar, name, and "3 reports" with the shared outcome in its color.
@Composable
private fun SenderReportsHeader(
    latest: SmsApi.AlertSummary,
    report: SmsApi.AlertReport,
    count: Int,
) {
    val review = reportReview(report)
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        SenderAvatar(sender = latest.sender.ifEmpty { "?" }, size = 64.dp)
        Spacer(Modifier.height(12.dp))
        Text(
            latest.senderName ?: latest.sender.ifEmpty { stringResource(R.string.unknown_sender) },
            color = White,
            fontWeight = FontWeight.Bold,
            fontSize = TextSize.Title,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Spacer(Modifier.height(2.dp))
        Text(
            pluralStringResource(R.plurals.reports_count, count, count) + " · " + stringResource(review.label),
            color = review.color,
            fontSize = TextSize.Footnote,
        )
    }
}

// When it was reported, then "Reported as spam · 4 messages".
@Composable
private fun SenderReportRow(
    group: List<SmsApi.AlertSummary>,
    onClick: () -> Unit,
) {
    val first = group.first()
    val report = first.report ?: return
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(start = 16.dp, end = 12.dp, top = 11.dp, bottom = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                formatAlertTimestamp(report.createdAt ?: first.receivedAt),
                color = White,
                fontSize = TextSize.Body,
                maxLines = 1,
            )
            Spacer(Modifier.height(2.dp))
            ReportStatusLine(
                report,
                suffix =
                    if (group.size > 1) {
                        pluralStringResource(R.plurals.alerts_report_group_messages, group.size, group.size)
                    } else {
                        null
                    },
            )
        }
        Icon(
            Icons.Default.ChevronRight,
            contentDescription = null,
            tint = TextTertiary,
            modifier = Modifier.size(16.dp),
        )
    }
}
