package com.bantai.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.HighlightOff
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.bantai.R
import com.bantai.data.model.REPORT_REJECTED
import com.bantai.data.model.REPORT_VALIDATED
import com.bantai.data.remote.SmsApi
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.SuspiciousText
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize

/** "Reported as scam/spam/safe" for a report's label (Scam/Spam/Ham). */
fun reportedAsRes(reportedLabel: String): Int =
    when (reportedLabel) {
        "Scam" -> R.string.alerts_reported_as_scam
        "Spam" -> R.string.alerts_reported_as_spam
        else -> R.string.alerts_reported_as_safe
    }

/** Where BantAI's review of a report stands: its name, explanation, glyph and color. */
data class ReportReview(
    val label: Int,
    val detail: Int,
    val icon: ImageVector,
    val color: Color,
)

@Composable
fun reportReview(report: SmsApi.AlertReport): ReportReview =
    when (report.status) {
        REPORT_VALIDATED ->
            ReportReview(
                R.string.alerts_report_accepted,
                R.string.alert_reported_accepted_detail,
                Icons.Outlined.CheckCircle,
                Safe,
            )
        REPORT_REJECTED ->
            ReportReview(
                R.string.alerts_report_rejected,
                R.string.alert_reported_rejected_detail,
                Icons.Outlined.HighlightOff,
                TextSecondary,
            )
        else ->
            ReportReview(
                R.string.alerts_report_pending,
                R.string.alert_reported_pending_detail,
                Icons.Outlined.Schedule,
                SuspiciousText,
            )
    }

/**
 * A report row's second line: the review glyph (clock, check, cross) and
 * "Reported as scam", plus an optional [suffix] such as "4 messages". The
 * outcome itself is spelled out on the report page, so the row stays one
 * quiet line; the glyph is still read out for accessibility. [showLabel]
 * false drops "Reported as ..." for a row covering several reports whose
 * labels may differ, leaving the glyph and [suffix] ("3 reports").
 */
@Composable
fun ReportStatusLine(
    report: SmsApi.AlertReport,
    modifier: Modifier = Modifier,
    suffix: String? = null,
    showLabel: Boolean = true,
) {
    val review = reportReview(report)
    val said = stringResource(reportedAsRes(report.reportedLabel))
    val text =
        when {
            !showLabel && suffix != null -> suffix
            suffix == null -> said
            else -> "$said · $suffix"
        }
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Icon(
            review.icon,
            contentDescription = stringResource(review.label),
            tint = review.color,
            modifier = Modifier.size(14.dp),
        )
        Text(
            text,
            color = TextSecondary,
            fontSize = TextSize.Subhead,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
