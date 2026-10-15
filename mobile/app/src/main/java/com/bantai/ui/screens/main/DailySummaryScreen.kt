package com.bantai.ui.screens.main

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.GppMaybe
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bantai.R
import com.bantai.container
import com.bantai.data.DailySummary
import com.bantai.data.model.SmsMessage
import com.bantai.ui.theme.BantaiShapes
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.OnIndigo
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White
import com.bantai.util.MessageTime
import com.bantai.util.SmsLinkSafety

private const val DIM_ALPHA = 0.66f
private const val MAX_SCAMS_SHOWN = 3

/**
 * The evening recap, opened from its notification: a card over the dimmed
 * app (the same look as the walkthrough), not a page of its own. It says what
 * BantAI caught today -- since midnight, so just after 12 it reads clear --
 * and offers the way on: Messages, or Alerts when there are scams to look at.
 * Tapping outside the card or Back closes it.
 */
@Composable
fun DailySummaryOverlay(
    onDismiss: () -> Unit,
    onOpenMessages: () -> Unit,
    onOpenAlerts: () -> Unit,
) {
    val context = LocalContext.current
    var summary by remember { mutableStateOf<DailySummary?>(null) }
    val hideUnknown by context.container.userPreferences.hideUnknown
        .collectAsState(initial = false)
    LaunchedEffect(Unit) { summary = DailySummary.load(context) }
    BackHandler(onBack = onDismiss)

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = DIM_ALPHA))
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = onDismiss,
                ).systemBarsPadding()
                .padding(20.dp),
        contentAlignment = Alignment.Center,
    ) {
        val data = summary ?: return@Box
        Column(
            modifier =
                Modifier
                    .widthIn(max = 420.dp)
                    .fillMaxWidth()
                    .shadow(16.dp, BantaiShapes.Large)
                    .background(SurfaceElevated, BantaiShapes.Large)
                    // The card itself doesn't close the overlay.
                    .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
                    .verticalScroll(rememberScrollState())
                    .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            SummaryVerdict(data)
            Spacer(Modifier.height(16.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val tile = Modifier.weight(1f)
                StatTile(stringResource(R.string.summary_stat_scams), data.scams.size, Danger, tile)
                StatTile(stringResource(R.string.summary_stat_spam), data.spamCount, TextSecondary, tile)
                if (!hideUnknown) {
                    StatTile(stringResource(R.string.summary_stat_unknown), data.unknownCount, Suspicious, tile)
                }
            }
            if (data.scams.isNotEmpty()) {
                Spacer(Modifier.height(14.dp))
                ScamList(data.scams.take(MAX_SCAMS_SHOWN))
            }
            Spacer(Modifier.height(18.dp))
            SummaryButtons(
                hasScams = data.scams.isNotEmpty(),
                onOpenMessages = onOpenMessages,
                onOpenAlerts = onOpenAlerts,
            )
        }
    }
}

@Composable
private fun SummaryVerdict(data: DailySummary) {
    val clear = data.isClear
    Icon(
        if (clear) Icons.Outlined.VerifiedUser else Icons.Outlined.GppMaybe,
        contentDescription = null,
        tint = if (clear) Safe else Danger,
        modifier = Modifier.size(44.dp),
    )
    Spacer(Modifier.height(10.dp))
    Text(
        if (clear) {
            stringResource(R.string.summary_safe_title)
        } else {
            pluralStringResource(R.plurals.summary_notif_scams_title, data.scams.size, data.scams.size)
        },
        color = White,
        fontWeight = FontWeight.Bold,
        fontSize = TextSize.Title,
        textAlign = TextAlign.Center,
    )
    Spacer(Modifier.height(4.dp))
    Text(
        stringResource(if (clear) R.string.summary_safe_detail else R.string.summary_scams_detail),
        color = TextSecondary,
        fontSize = TextSize.Subhead,
        lineHeight = 20.sp,
        textAlign = TextAlign.Center,
    )
}

// The newest few scams, links and numbers masked; the rest are in Alerts.
@Composable
private fun ScamList(scams: List<SmsMessage>) {
    val context = LocalContext.current
    Column(Modifier.fillMaxWidth().background(Surface, BantaiShapes.Medium)) {
        scams.forEachIndexed { index, message ->
            if (index > 0) HorizontalDivider(color = Hairline, thickness = 0.5.dp)
            Column(Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        message.sender,
                        color = White,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = TextSize.Subhead,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        MessageTime.listLabel(context, message.timestamp),
                        color = TextSecondary,
                        fontSize = TextSize.Caption,
                    )
                }
                Text(
                    SmsLinkSafety.maskSensitive(message.body),
                    color = TextSecondary,
                    fontSize = TextSize.Footnote,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun SummaryButtons(
    hasScams: Boolean,
    onOpenMessages: () -> Unit,
    onOpenAlerts: () -> Unit,
) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        PillButton(
            label = stringResource(R.string.summary_go_messages),
            filled = !hasScams,
            onClick = onOpenMessages,
            modifier = Modifier.weight(1f),
        )
        if (hasScams) {
            PillButton(
                label = stringResource(R.string.summary_go_alerts),
                filled = true,
                onClick = onOpenAlerts,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun PillButton(
    label: String,
    filled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .background(if (filled) Indigo else Surface, BantaiShapes.Pill)
                .clickable(onClick = onClick)
                .padding(vertical = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            color = if (filled) OnIndigo else White,
            fontSize = TextSize.Subhead,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun StatTile(
    label: String,
    count: Int,
    color: Color,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.background(Surface, BantaiShapes.Medium).padding(vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            count.toString(),
            color = if (count > 0) color else White,
            fontWeight = FontWeight.Bold,
            fontSize = TextSize.Title,
        )
        Text(label, color = TextSecondary, fontSize = TextSize.Footnote)
    }
}
