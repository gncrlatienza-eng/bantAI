package com.bantai.ui.screens.main

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBackIos
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.Inbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.data.model.ConversationView
import com.bantai.data.model.reportKey
import com.bantai.data.remote.SmsApi
import com.bantai.navigation.Screen
import com.bantai.navigation.rememberSafePopBack
import com.bantai.ui.components.LocalBottomBarClearance
import com.bantai.ui.components.SecondaryButton
import com.bantai.ui.components.SenderAvatar
import com.bantai.ui.components.StateMessage
import com.bantai.ui.components.reportReview
import com.bantai.ui.components.reportedAsRes
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.IosBlue
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White
import com.bantai.viewmodel.AlertsViewModel

/**
 * One report, opened from Alerts -> Reported: where BantAI's review stands,
 * what the user said (label and note), any note from the reviewer, and the
 * reported message(s). Built from the alert page's pieces (InfoCard,
 * MessageBubble) so the two read as one family. [reportKey] is the report's
 * groupId, or its message id for a single-message report.
 */
@Composable
fun ReportDetailScreen(
    reportKey: String,
    navController: NavController,
    alertsViewModel: AlertsViewModel,
) {
    val alerts by alertsViewModel.alerts.collectAsState()
    val reports =
        remember(alerts, reportKey) {
            alerts.filter { it.report != null && reportKey(it) == reportKey }.sortedBy { it.receivedAt }
        }
    val popBack = rememberSafePopBack(navController)

    Column(modifier = Modifier.fillMaxSize().background(Black)) {
        DetailBackRow(popBack)

        val first = reports.firstOrNull()
        val report = first?.report
        if (first == null || report == null) {
            StateMessage(icon = Icons.Outlined.Inbox, title = stringResource(R.string.report_detail_gone))
            return@Column
        }
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding =
                PaddingValues(start = 20.dp, top = 8.dp, end = 20.dp, bottom = LocalBottomBarClearance.current),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            item { ReportHeader(first, report) }
            item { ReviewCard(report) }
            item { YourReportCard(report) }
            item { MessagesHeader(reports.size) }
            items(reports, key = { it.messageId }) { MessageBubble(it) }
            val localIds = reports.mapNotNull { it.localId }
            if (first.sender.isNotEmpty() && localIds.isNotEmpty()) {
                item {
                    SecondaryButton(stringResource(R.string.report_detail_view_conversation)) {
                        navController.navigate(Screen.Detail.createRoute(first.sender, ConversationView.ALL, localIds))
                    }
                }
            }
        }
    }
}

// Plain "< Back", same as the alert page (reached from Alerts, so no tab name).
@Composable
internal fun DetailBackRow(onBack: () -> Unit) {
    Row(
        modifier =
            Modifier
                .statusBarsPadding()
                .padding(top = 6.dp)
                .clickable(onClick = onBack)
                .padding(horizontal = 12.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            Icons.AutoMirrored.Filled.ArrowBackIos,
            contentDescription = null,
            tint = IosBlue,
            modifier = Modifier.size(16.dp),
        )
        Spacer(Modifier.width(2.dp))
        Text(stringResource(R.string.action_back), color = IosBlue, fontSize = TextSize.Body)
    }
}

// iOS grouped-list section caption above the bubbles.
@Composable
private fun MessagesHeader(count: Int) {
    Text(
        if (count == 1) {
            stringResource(R.string.report_detail_message)
        } else {
            stringResource(R.string.report_detail_messages, count)
        }.uppercase(),
        color = TextSecondary,
        fontSize = TextSize.Footnote,
        modifier = Modifier.padding(start = 4.dp),
    )
}

// Who it was from, when it was reported, and the outcome as a tinted capsule
// -- the same header the alert page has.
@Composable
private fun ReportHeader(
    alert: SmsApi.AlertSummary,
    report: SmsApi.AlertReport,
) {
    val review = reportReview(report)
    Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        SenderAvatar(sender = alert.sender.ifEmpty { "?" }, size = 64.dp)
        Spacer(Modifier.height(12.dp))
        Text(
            alert.senderName ?: alert.sender.ifEmpty { stringResource(R.string.unknown_sender) },
            color = White,
            fontWeight = FontWeight.Bold,
            fontSize = TextSize.Title,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        report.createdAt?.let {
            Spacer(Modifier.height(2.dp))
            Text(
                stringResource(R.string.report_detail_reported_on, formatAlertTimestamp(it)),
                color = TextSecondary,
                fontSize = TextSize.Footnote,
            )
        }
        Spacer(Modifier.height(12.dp))
        Row(
            modifier =
                Modifier
                    .background(review.color.copy(alpha = 0.15f), RoundedCornerShape(100.dp))
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(review.icon, contentDescription = null, tint = review.color, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(6.dp))
            Text(
                stringResource(review.label),
                color = review.color,
                fontWeight = FontWeight.SemiBold,
                fontSize = TextSize.Footnote,
            )
        }
    }
}

// The review: what the outcome means, when it happened, and the reviewer's
// reason when they gave one.
@Composable
private fun ReviewCard(report: SmsApi.AlertReport) {
    val review = reportReview(report)
    DetailCard(review.icon, review.color, stringResource(review.label)) {
        DetailCardBody(stringResource(review.detail))
        report.reviewedAt?.let {
            Text(
                stringResource(R.string.report_detail_reviewed_on, formatAlertTimestamp(it)),
                color = TextSecondary,
                fontSize = TextSize.Footnote,
            )
        }
        report.adminNote?.let { note ->
            HorizontalDivider(color = Hairline, thickness = 0.5.dp, modifier = Modifier.padding(vertical = 4.dp))
            NoteField(stringResource(R.string.report_detail_team_note), note)
        }
    }
}

// What the user said: the label they chose and the note they wrote, if any.
@Composable
private fun YourReportCard(report: SmsApi.AlertReport) {
    DetailCard(Icons.Outlined.Flag, Indigo, stringResource(R.string.report_detail_your_report)) {
        Text(
            stringResource(reportedAsRes(report.reportedLabel)),
            color = White,
            fontSize = TextSize.Subhead,
            fontWeight = FontWeight.Medium,
        )
        HorizontalDivider(color = Hairline, thickness = 0.5.dp, modifier = Modifier.padding(vertical = 4.dp))
        val note = report.note
        if (note.isNullOrBlank()) {
            Text(
                stringResource(R.string.report_detail_no_note),
                color = TextSecondary,
                fontSize = TextSize.Subhead,
                fontStyle = FontStyle.Italic,
            )
        } else {
            NoteField(stringResource(R.string.report_detail_your_note), note)
        }
    }
}

// A small grey caption over the note itself, like an iOS form field.
@Composable
private fun NoteField(
    label: String,
    text: String,
) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, color = TextSecondary, fontSize = TextSize.Footnote)
        Text(text, color = White, fontSize = TextSize.Subhead, lineHeight = 20.sp)
    }
}
