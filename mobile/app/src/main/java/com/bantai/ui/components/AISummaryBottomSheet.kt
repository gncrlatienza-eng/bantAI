package com.bantai.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bantai.R
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.IosBlue
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White

/**
 * @param summary Extractive summary text for this thread, computed entirely
 *   on-device (`data/model/SmsConversations.kt`'s TF-IDF sentence scoring,
 *   `MessageDetailScreen`'s only current caller) -- the backend's `POST
 *   /ai/summarize` is deliberately disabled (410 Gone) in privacy-first mode,
 *   so there is no remote summarizer for a caller to use here. Null while
 *   loading; blank is a legitimate "nothing worth extracting" result, not an
 *   error -- falls back to generic verdict-based guidance rather than an
 *   empty sheet.
 * @param sourceMessageCount How many messages fed the summary, shown as a
 *   caption so the summary is never mistaken for the whole thread (only
 *   shown when set and > 0).
 * @param isLoadingSummary True while the summary is being produced.
 * @param topic Keyword-based description of what the thread is about
 *   (`data/model/ThreadTopic.kt`), shown above the extracted sentences.
 * @param isTrusted The sender is a trusted organisation (see TrustedSenders):
 *   the sheet shows a "Trusted sender" verdict and no report/block entry.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
@Suppress("LongMethod", "LongParameterList", "CyclomaticComplexMethod")
fun AISummaryBottomSheet(
    onDismiss: () -> Unit,
    onViewFullAnalysis: () -> Unit,
    isSuspicious: Boolean = true,
    summary: String? = null,
    sourceMessageCount: Int? = null,
    isLoadingSummary: Boolean = false,
    topic: String? = null,
    isTrusted: Boolean = false,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = SurfaceElevated,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
        dragHandle = { BottomSheetDefaults.DragHandle() },
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Icon(
                    Icons.Outlined.AutoAwesome,
                    contentDescription = null,
                    tint = Indigo,
                    modifier = Modifier.size(20.dp),
                )
                Text(
                    stringResource(R.string.ai_summary_bottom_sheet_ai_summary),
                    color = White,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = TextSize.Headline,
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = onDismiss, modifier = Modifier.size(32.dp)) {
                    Icon(
                        Icons.Default.Close,
                        contentDescription = stringResource(R.string.action_close),
                        tint = TextTertiary,
                        modifier = Modifier.size(18.dp),
                    )
                }
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                val verdictColor =
                    when {
                        isTrusted -> IosBlue
                        isSuspicious -> Suspicious
                        else -> Safe
                    }
                Box(
                    modifier =
                        Modifier
                            .background(verdictColor.copy(alpha = 0.2f), RoundedCornerShape(100.dp))
                            .padding(horizontal = 8.dp, vertical = 3.dp),
                ) {
                    Text(
                        stringResource(
                            when {
                                isTrusted -> R.string.thread_trusted_sender
                                isSuspicious -> R.string.verdict_suspicious
                                else -> R.string.ai_summary_looks_safe
                            },
                        ),
                        color = verdictColor,
                        fontSize = TextSize.Caption2,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }

            if (isLoadingSummary) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    CircularProgressIndicator(color = Indigo, modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
                    Text(
                        stringResource(R.string.ai_summary_bottom_sheet_summarizing_conversation),
                        color = TextSecondary,
                        fontSize = TextSize.Footnote,
                    )
                }
            } else {
                if (!topic.isNullOrBlank()) {
                    Text(
                        stringResource(R.string.ai_summary_bottom_sheet_what_it_s_about),
                        color = TextSecondary,
                        fontSize = TextSize.Caption2,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(topic, color = White, fontSize = TextSize.Subhead, lineHeight = 20.sp)
                    if (!summary.isNullOrBlank()) {
                        Text(
                            stringResource(R.string.ai_summary_bottom_sheet_key_messages),
                            color = TextSecondary,
                            fontSize = TextSize.Caption2,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
                if (!summary.isNullOrBlank() || topic.isNullOrBlank()) {
                    Text(
                        if (!summary.isNullOrBlank()) {
                            summary
                        } else if (isSuspicious && !isTrusted) {
                            stringResource(R.string.ai_summary_fallback_suspicious)
                        } else {
                            stringResource(R.string.ai_summary_fallback_safe)
                        },
                        color = White,
                        fontSize = TextSize.Subhead,
                        lineHeight = 20.sp,
                    )
                }
                // Only shown alongside a real generated summary (never the
                // verdict-based fallback text above) -- see docs/api/summarize.md:
                // the summary must never be presented as if it were the whole
                // thread.
                if (sourceMessageCount != null && sourceMessageCount > 0) {
                    Text(
                        pluralStringResource(R.plurals.ai_summary_source_count, sourceMessageCount, sourceMessageCount),
                        color = TextSecondary,
                        fontSize = TextSize.Caption2,
                    )
                }
            }

            // Trusted senders get the summary only -- nothing to report or block.
            if (!isTrusted) {
                HorizontalDivider(color = Hairline, thickness = 0.5.dp)
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clickable(onClick = onViewFullAnalysis)
                            .padding(vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        stringResource(R.string.ai_summary_bottom_sheet_report_or_block_this_sender),
                        color = Indigo,
                        fontSize = TextSize.Body,
                        modifier = Modifier.weight(1f),
                    )
                    Icon(
                        Icons.Default.ChevronRight,
                        contentDescription = null,
                        tint = TextTertiary,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }
        }
    }
}
