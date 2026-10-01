package com.bantai.ui.screens.main

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBackIos
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.Inbox
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.container
import com.bantai.data.local.AlertState
import com.bantai.data.model.AlertKind
import com.bantai.data.model.REPORT_REJECTED
import com.bantai.data.model.REPORT_VALIDATED
import com.bantai.data.model.isScamVerdict
import com.bantai.data.model.kind
import com.bantai.data.model.withLocalReports
import com.bantai.data.remote.SmsApi
import com.bantai.navigation.Screen
import com.bantai.ui.components.DetailSkeleton
import com.bantai.ui.components.LocalBottomBarClearance
import com.bantai.ui.components.PrimaryButton
import com.bantai.ui.components.SecondaryButton
import com.bantai.ui.components.SenderAvatar
import com.bantai.ui.components.StateMessage
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.IosBlue
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.SuspiciousText
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White
import com.bantai.util.IndicatorExplanations
import com.bantai.util.SmsRiskSignals
import com.bantai.util.SmsSourceId
import com.bantai.viewmodel.AlertDetailViewModel
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
@Suppress("LongMethod") // back row plus the loading/error/empty/content states
fun SmishingAlertScreen(
    messageId: String,
    navController: NavController,
    viewModel: AlertDetailViewModel = viewModel(),
) {
    val alert by viewModel.alert.collectAsState()
    val indicators by viewModel.indicators.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val resolvedSender by viewModel.resolvedSender.collectAsState()
    val isTrustedSender by viewModel.isTrustedSender.collectAsState()
    val waveSize by viewModel.waveSize.collectAsState()

    val context = LocalContext.current
    val alertStateStore = remember { context.container.alertStateStore }
    val alertState by alertStateStore.state.collectAsState(initial = AlertState())
    LaunchedEffect(messageId) {
        viewModel.load(messageId)
        // Opening an alert from anywhere (Alerts, a notification, Campaigns)
        // clears its "new" dot and the tab count.
        alertStateStore.markSeen(messageId)
    }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black),
    ) {
        // iOS-style back affordance. Plain "Back": this screen is reached from
        // Alerts, Campaigns and notifications, so naming one of them was wrong
        // from the other two.
        Row(
            modifier =
                Modifier
                    .statusBarsPadding()
                    .padding(top = 6.dp)
                    .clickable { navController.popBackStack() }
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

        val current = alert
        when {
            isLoading -> DetailSkeleton()
            errorMessage != null ->
                StateMessage(
                    icon = Icons.Outlined.CloudOff,
                    title = stringResource(R.string.alert_load_failed),
                    detail = errorMessage,
                    actionLabel = stringResource(R.string.action_retry),
                    onAction = { viewModel.load(messageId) },
                )
            current == null ->
                StateMessage(
                    icon = Icons.Outlined.Inbox,
                    title = stringResource(R.string.alert_gone_title),
                    detail = stringResource(R.string.alert_gone_detail),
                )
            else ->
                SmishingAlertContent(
                    // A report just filed from this phone counts before the
                    // backend's list catches up.
                    alert = withLocalReports(listOf(current), alertState.reported).first(),
                    resolvedSender = resolvedSender,
                    isTrustedSender = isTrustedSender,
                    waveSize = waveSize,
                    indicators = indicators,
                    navController = navController,
                )
        }
    }
}

/**
 * One fact per line, top to bottom: who sent it and the verdict, the message
 * itself, why it was flagged, then what can be done.
 * - Once the user has reported it, there's nothing left to report: the
 *   actions give way to what they reported and where the review stands
 *   (Block stays for an unblocked, untrusted sender).
 * - A scam whose sender really is blocked (AlertKind.BLOCKED) is a record,
 *   with a "Not a scam?" report for a wrong verdict.
 * - Anything else from an ordinary sender needs a decision: Block, Report as
 *   scam, or mark it reviewed. This used to show "Blocked automatically" too,
 *   which told the user they were protected when nothing had been blocked.
 * - A trusted sender name (bank, e-wallet, telco, app -- see TrustedSenders)
 *   is never blocked: names are spoofable (e.g. by SMS blasters), so blocking
 *   "BDO" would block the real bank too. It gets Report only, plus a warning
 *   when the content gives a spoof away (SmsRiskSignals.spoofWarning).
 */
@Composable
@Suppress("LongParameterList", "LongMethod")
private fun SmishingAlertContent(
    alert: SmsApi.AlertSummary,
    resolvedSender: String,
    isTrustedSender: Boolean,
    waveSize: Int?,
    indicators: List<SmsApi.IndicatorTag>,
    navController: NavController,
) {
    val isScam = alert.isScamVerdict()
    // The phone's own row for this alert, so a report can re-file the message
    // under the label the user picked (TakeActionScreen.refileReported).
    val localId = SmsSourceId.localRowId(LocalContext.current, alert.sourceId)

    // resolvedSender (from the local SMS provider) instead of alert.sender,
    // which the backend always sends as "".
    fun openTakeAction(
        action: String,
        canBlock: Boolean,
    ) = navController.navigate(
        Screen.TakeAction.createRoute(
            messageId = alert.messageId,
            sender = resolvedSender,
            localId = localId,
            // Blank: every alert offers all three labels. Confirming the
            // model's own verdict ("yes, it's a scam") is a valid report --
            // it's how a To review alert gets reviewed (backend accepts it
            // since reports.service stopped rejecting matching labels).
            currentLabel = "",
            action = action,
            canBlock = canBlock,
        ),
    )

    val thisSender = stringResource(R.string.alert_this_sender)
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        // Bottom clearance matches the floating tab bar's footprint.
        contentPadding =
            PaddingValues(
                start = 20.dp,
                top = 8.dp,
                end = 20.dp,
                bottom = LocalBottomBarClearance.current,
            ),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        item { AlertHeader(alert, resolvedSender) }

        item { MessageBubble(alert) }

        if (indicators.isNotEmpty()) {
            item { ReasonsCard(indicators) }
        }

        alert.clusterId?.let { clusterId ->
            item {
                CampaignRow(
                    waveSize = waveSize,
                    onClick = { navController.navigate(Screen.CampaignDetail.createRoute(clusterId)) },
                )
            }
        }

        val report = alert.report
        when {
            report != null -> {
                item { ReportedNote(report) }
                if (!isTrustedSender && alert.kind() != AlertKind.BLOCKED) {
                    item {
                        SecondaryButton(stringResource(R.string.alert_block_sender)) {
                            openTakeAction("block", canBlock = true)
                        }
                    }
                }
            }
            isTrustedSender -> {
                SmsRiskSignals.spoofWarning(resolvedSender, alert.body)?.let { warning ->
                    item { SpoofWarningCard(warning) }
                }
                item { TrustedSenderNote(resolvedSender.ifEmpty { thisSender }) }
                item {
                    PrimaryButton(stringResource(R.string.alert_report_message)) {
                        openTakeAction("report", canBlock = false)
                    }
                }
            }
            alert.kind() == AlertKind.BLOCKED ->
                item { AutoBlockedNote(onReportMistake = { openTakeAction("report", canBlock = false) }) }
            else -> {
                item { NotBlockedNote(isScam) }
                // Report is the review: Ham, Spam or Scam files the text there
                // and moves the alert to Reported.
                item {
                    PrimaryButton(stringResource(R.string.alert_report_message)) {
                        openTakeAction("report", canBlock = false)
                    }
                }
                item {
                    SecondaryButton(stringResource(R.string.alert_block_sender)) {
                        openTakeAction("block", canBlock = true)
                    }
                }
            }
        }
    }
}

@Composable
private fun AlertHeader(
    alert: SmsApi.AlertSummary,
    resolvedSender: String,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        SenderAvatar(sender = resolvedSender.ifEmpty { "?" }, size = 64.dp)
        Spacer(Modifier.height(12.dp))
        Text(
            resolvedSender.ifEmpty { stringResource(R.string.unknown_sender) },
            color = White,
            fontWeight = FontWeight.Bold,
            fontSize = TextSize.Title,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Spacer(Modifier.height(2.dp))
        Text(formatFullTimestamp(alert.receivedAt), color = TextSecondary, fontSize = TextSize.Footnote)
        Spacer(Modifier.height(12.dp))
        // Same rule everywhere: red = likely scam, orange = suspicious.
        val isScam = alert.isScamVerdict()
        val tint = if (isScam) Danger else Suspicious
        Row(
            modifier =
                Modifier
                    .background(tint.copy(alpha = 0.15f), RoundedCornerShape(100.dp))
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(6.dp).background(tint, CircleShape))
            Spacer(Modifier.width(6.dp))
            // No percentage: the model's score is its confidence in itself (it
            // reads ~99.9% on nearly every scam verdict), not how often it's
            // right, so showing "100%" overstated certainty.
            Text(
                stringResource(if (isScam) R.string.verdict_likely_scam else R.string.verdict_suspicious),
                color = if (isScam) Danger else SuspiciousText,
                fontWeight = FontWeight.SemiBold,
                fontSize = TextSize.Footnote,
            )
        }
    }
}

@Composable
private fun MessageBubble(alert: SmsApi.AlertSummary) {
    Text(
        alert.body,
        color = White,
        fontSize = TextSize.Body,
        lineHeight = 21.sp,
        modifier =
            Modifier
                .fillMaxWidth()
                .background(SurfaceElevated, RoundedCornerShape(18.dp))
                .padding(horizontal = 16.dp, vertical = 14.dp),
    )
}

@Composable
private fun ReasonsCard(indicators: List<SmsApi.IndicatorTag>) {
    Column {
        Text(
            stringResource(R.string.alert_why_flagged),
            color = TextSecondary,
            fontSize = TextSize.Footnote,
            modifier = Modifier.padding(start = 4.dp, bottom = 8.dp),
        )
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(SurfaceElevated, RoundedCornerShape(14.dp)),
        ) {
            // Strongest reason first; the raw weights read as noise to users.
            val sorted = indicators.sortedByDescending { it.weight }
            sorted.forEachIndexed { index, indicator ->
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.Top,
                ) {
                    Box(
                        Modifier
                            .padding(top = 7.dp)
                            .size(6.dp)
                            .background(Danger, CircleShape),
                    )
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(indicator.tag, color = White, fontSize = TextSize.Body, fontWeight = FontWeight.Medium)
                        IndicatorExplanations.forTag(indicator.tag)?.let { explanation ->
                            Text(
                                stringResource(explanation),
                                color = TextSecondary,
                                fontSize = TextSize.Subhead,
                                lineHeight = 19.sp,
                            )
                        }
                    }
                }
                if (index != sorted.lastIndex) {
                    HorizontalDivider(color = Hairline, thickness = 0.5.dp, modifier = Modifier.padding(start = 34.dp))
                }
            }
        }
    }
}

@Composable
private fun SpoofWarningCard(warning: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(Suspicious.copy(alpha = 0.12f), RoundedCornerShape(14.dp))
                .padding(16.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Icon(
            Icons.Outlined.WarningAmber,
            contentDescription = null,
            tint = Suspicious,
            modifier = Modifier.size(18.dp),
        )
        Spacer(Modifier.width(10.dp))
        Text(warning, color = White, fontSize = TextSize.Subhead, lineHeight = 20.sp)
    }
}

@Composable
private fun InfoCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    iconTint: androidx.compose.ui.graphics.Color,
    title: String,
    content: @Composable () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(SurfaceElevated, RoundedCornerShape(14.dp))
                .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(10.dp))
            Text(title, color = White, fontWeight = FontWeight.SemiBold, fontSize = TextSize.Body)
        }
        content()
    }
}

@Composable
private fun CardBody(text: String) {
    Text(text, color = TextSecondary, fontSize = TextSize.Subhead, lineHeight = 20.sp)
}

@Composable
private fun TrustedSenderNote(senderName: String) {
    InfoCard(Icons.Outlined.VerifiedUser, IosBlue, stringResource(R.string.alert_trusted_title)) {
        CardBody(stringResource(R.string.alert_trusted_detail, senderName))
    }
}

@Composable
private fun AutoBlockedNote(onReportMistake: () -> Unit) {
    InfoCard(Icons.Default.Shield, Safe, stringResource(R.string.alert_blocked_title)) {
        CardBody(stringResource(R.string.alert_blocked_detail))
        Text(
            stringResource(R.string.alert_report_mistake),
            color = Indigo,
            fontWeight = FontWeight.SemiBold,
            fontSize = TextSize.Subhead,
            modifier = Modifier.clickable(onClick = onReportMistake).padding(vertical = 10.dp),
        )
    }
}

@Composable
private fun ReportedNote(report: SmsApi.AlertReport) {
    val (status, detail) =
        when (report.status) {
            REPORT_VALIDATED -> R.string.alerts_report_accepted to R.string.alert_reported_accepted_detail
            REPORT_REJECTED -> R.string.alerts_report_rejected to R.string.alert_reported_rejected_detail
            else -> R.string.alerts_report_pending to R.string.alert_reported_pending_detail
        }
    InfoCard(Icons.Outlined.Flag, Indigo, stringResource(R.string.alert_reported_title)) {
        Text(
            stringResource(reportedAsRes(report.reportedLabel)) + " · " + stringResource(status),
            color = White,
            fontSize = TextSize.Subhead,
            fontWeight = FontWeight.Medium,
        )
        CardBody(stringResource(detail))
    }
}

@Composable
private fun NotBlockedNote(isScam: Boolean) {
    InfoCard(Icons.Outlined.WarningAmber, Suspicious, stringResource(R.string.alert_not_blocked_title)) {
        CardBody(
            stringResource(
                if (isScam) R.string.alert_not_blocked_scam_detail else R.string.alert_not_blocked_suspicious_detail,
            ),
        )
    }
}

@Composable
// Works with the Scam Waves tab hidden: this is how most people learn a scam
// is a wider wave, in plain words ("sent 12 times") rather than "campaign".
private fun CampaignRow(
    waveSize: Int?,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(SurfaceElevated, RoundedCornerShape(14.dp))
                .clickable(onClick = onClick)
                .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Default.Hub, contentDescription = null, tint = Suspicious, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(stringResource(R.string.alert_part_of_campaign), color = White, fontSize = TextSize.Body)
            Text(
                if (waveSize != null) {
                    pluralStringResource(R.plurals.alert_wave_size, waveSize, waveSize)
                } else {
                    stringResource(R.string.alert_wave_detail)
                },
                color = TextSecondary,
                fontSize = TextSize.Footnote,
            )
        }
        Icon(
            Icons.Default.ChevronRight,
            contentDescription = null,
            tint = TextTertiary,
            modifier = Modifier.size(18.dp),
        )
    }
}

private fun formatFullTimestamp(iso: String): String =
    try {
        Instant
            .parse(iso)
            .atZone(ZoneId.systemDefault())
            .format(DateTimeFormatter.ofPattern("MMM d 'at' h:mm a", Locale.US))
    } catch (_: Exception) {
        ""
    }
