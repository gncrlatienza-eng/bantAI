package com.bantai.ui.screens.main

import android.content.Context
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.outlined.Block
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material.icons.outlined.ReportGmailerrorred
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.container
import com.bantai.data.SmsIngestPipeline
import com.bantai.data.model.Classification
import com.bantai.data.remote.ApiException
import com.bantai.data.remote.ReportsApi
import com.bantai.data.remote.VerificationApi
import com.bantai.navigation.Screen
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.OnAccent
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White
import com.bantai.util.BlockHelper
import com.bantai.util.DefaultSmsApp
import com.bantai.util.SenderReplyKind
import com.bantai.util.replyKindFor
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

private const val DISABLED_CARD_ALPHA = 0.4f

// Each option is a concrete correction for the backend's SubmitReportDto
// (Ham/Spam/Scam) -- reports feed AI retraining, so every choice has to name
// the label the message should have had, including "this is legit".
private data class ReportOption(
    @StringRes val title: Int,
    val reportedLabel: String,
)

private val allReportOptions =
    listOf(
        ReportOption(R.string.take_action_option_scam, "Scam"),
        ReportOption(R.string.take_action_option_spam, "Spam"),
        ReportOption(R.string.take_action_option_ham, "Ham"),
    )

// The backend rejects a "correction" that matches the current verdict, so that
// option is hidden; with no known label (e.g. an Unknown message) all show.
private fun reportOptionsFor(label: String): List<ReportOption> = allReportOptions.filter { it.reportedLabel != label }

private class NotDefaultSmsAppException : Exception("Set BantAI as your default SMS app to block numbers.")

/** TakeAction `action` value for the one-tap "Report as scam" shortcut. */
const val PRESELECT_REPORT_SCAM = "report_scam"

private data class TakeActionRequest(
    val reportSelected: Boolean,
    val blockSelected: Boolean,
    val messageId: String,
    val localMessageId: Long?,
    val sender: String,
    val reportedLabel: String?,
    val notes: String = "",
)

@Suppress("ReturnCount") // each early return is a distinct, user-facing failure
private suspend fun submitReportIfSelected(
    context: Context,
    request: TakeActionRequest,
): Result<Unit> {
    if (!request.reportSelected) return Result.success(Unit)
    if (request.reportedLabel == null) {
        return Result.failure(Exception(context.getString(R.string.take_action_error_choose_label)))
    }
    val token =
        context.container.userPreferences.userData
            .first()
            .authToken
    if (token.isEmpty()) return Result.failure(Exception(context.getString(R.string.take_action_error_sign_in)))
    // A message the backend hasn't seen yet (never scanned, or never flagged) is
    // registered on the spot rather than making Report unavailable for it.
    val messageId =
        request.messageId.ifBlank {
            request.localMessageId?.let { SmsIngestPipeline.backendMessageIdFor(context, token, it) }.orEmpty()
        }
    if (messageId.isBlank()) {
        // Say so instead of silently no-opping into a "submitted" confirmation screen.
        return Result.failure(Exception(context.getString(R.string.take_action_error_offline)))
    }
    val submitted = ReportsApi.submit(token, messageId, request.reportedLabel, request.notes)
    if (submitted.isSuccess && request.reportedLabel == "Scam") fileSenderReport(token, request.sender)
    // Filed now, or already filed before (the backend allows one per message):
    // either way the alert belongs under Reported, where Report isn't offered.
    val alreadyReported = (submitted.exceptionOrNull() as? ApiException)?.status == HTTP_CONFLICT
    if (submitted.isSuccess || alreadyReported) {
        context.container.alertStateStore.markReported(messageId, request.reportedLabel)
    }
    if (submitted.isSuccess) refileReported(context, request.localMessageId, request.reportedLabel)
    return submitted
}

/**
 * Moves the reported message to the chip the user chose, right away -- a report
 * used to change nothing on the phone, so a scam reported from Messages stayed
 * in Messages. Ham -> Messages, Spam -> Spam. Scam -> Unknown: a scam label
 * hides a sender's whole thread from every chip (it's meant to live in Alerts),
 * and a report doesn't create an alert, so the text would vanish. A message
 * already filed as a scam (an alert) stays one.
 */
private suspend fun refileReported(
    context: Context,
    localMessageId: Long?,
    reportedLabel: String,
) {
    if (localMessageId == null || localMessageId <= 0) return
    val store = context.container.classificationStore
    val current = store.snapshotFor(localMessageId)
    val label =
        when (reportedLabel) {
            "Ham" -> Classification.SAFE
            "Spam" -> Classification.SPAM
            else -> if (current == Classification.SCAM) return else Classification.UNKNOWN
        }
    store.setClassification(localMessageId, label)
}

private const val HTTP_CONFLICT = 409

// Corroborating evidence so several users reporting the same number can get it
// confirmed as fraud for everyone. Only real phone numbers: brand sender IDs
// ("BPI", "GCash") are routinely spoofed, so flagging the ID would flag every
// genuine message from that brand. Best-effort -- the message report already
// succeeded, and a repeat report of the same sender (409) is expected.
private suspend fun fileSenderReport(
    token: String,
    sender: String,
) {
    if (replyKindFor(sender) != SenderReplyKind.PHONE_NUMBER) return
    VerificationApi.reportSender(token, sender)
}

// Blocks at the device level (the part that actually stops the sender), then
// best-effort mirrors the block to the backend (BlockHelper.blockSender), which
// also moves the sender's server-side alerts to Blocked. Verifies the
// device-level block actually landed before reporting success, since the
// confirmation screen's "can no longer send you messages" claim must be true,
// not just attempted.
private suspend fun blockIfSelected(
    context: Context,
    request: TakeActionRequest,
): Result<Unit> {
    if (!request.blockSelected) return Result.success(Unit)
    if (request.sender.isBlank()) {
        return Result.failure(
            Exception(context.getString(R.string.take_action_error_no_number)),
        )
    }
    // Android only lets the default SMS (or phone) app write to its block list;
    // any other app's insert is refused, which used to surface as a bare
    // "Couldn't block this number" with no way forward.
    if (!DefaultSmsApp.isDefault(context)) {
        return Result.failure(NotDefaultSmsAppException())
    }
    // Same path as an auto-block, so the sender also lands in Blocked Numbers'
    // local record (BlockedSendersStore) and Alerts sees it as blocked.
    val token =
        context.container.userPreferences.userData
            .first()
            .authToken
    val outcome = BlockHelper.blockSender(context, token, request.sender)
    if (!outcome.onDevice) {
        return Result.failure(Exception(context.getString(R.string.take_action_error_block_failed)))
    }
    return Result.success(Unit)
}

// Performs whichever of Report/Block were selected and only reports success once
// every selected action has actually happened — no more treating "nothing
// submittable" as equivalent to success.
private suspend fun performTakeAction(
    context: Context,
    request: TakeActionRequest,
): Result<Unit> {
    val blockResult = blockIfSelected(context, request)
    if (blockResult.isFailure) return blockResult
    return submitReportIfSelected(context, request)
}

/**
 * @param messageId backend `SmsMessage` UUID for the message being reported, when the
 *   caller already has one (alerts, flagged banners).
 * @param localMessageId device SMS row id; lets any message be reported by resolving or
 *   registering its backend id at submit time. Report is only unavailable when neither
 *   id exists.
 * @param currentLabel the message's current verdict (Ham/Spam/Scam, blank if unsure),
 *   used to hide the report option that would repeat it.
 * @param sender shown in the confirmation dialog, and required to actually Block (a
 *   blank sender rejects the block with an explanatory toast).
 * @param preselect "report" or "block" to start with that option already chosen.
 * @param canBlock false hides Block entirely -- for a trusted sender name (blocking
 *   "BDO" would also block the real bank, since names are spoofable) or a sender
 *   BantAI already blocked.
 */
@Composable
@Suppress("LongMethod", "LongParameterList", "CyclomaticComplexMethod")
fun TakeActionScreen(
    navController: NavController,
    messageId: String = "",
    sender: String = "",
    localMessageId: Long? = null,
    currentLabel: String = "",
    preselect: String = "",
    canBlock: Boolean = true,
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val canReport = messageId.isNotBlank() || localMessageId != null
    val reportOptions = remember(currentLabel) { reportOptionsFor(currentLabel) }
    // "report_scam" is the one-tap shortcut: Report with "Scam" already chosen,
    // straight to the confirmation.
    val quickScamReport = preselect == PRESELECT_REPORT_SCAM
    var reportSelected by remember { mutableStateOf(canReport && (preselect == "report" || quickScamReport)) }
    // Block needs the default SMS app role; asked for up front (below) rather
    // than only discovered at Submit.
    var blockSelected by remember {
        mutableStateOf(canBlock && preselect == "block" && BlockHelper.isDefaultSmsApp(context))
    }
    var selectedReportType by remember {
        mutableIntStateOf(
            if (quickScamReport) reportOptions.indexOfFirst { it.reportedLabel == "Scam" }.coerceAtLeast(0) else 0,
        )
    }
    var notes by remember { mutableStateOf("") }
    var showDialog by remember { mutableStateOf(false) }
    var isSubmitting by remember { mutableStateOf(false) }
    var showDefaultSmsPrompt by remember {
        mutableStateOf(canBlock && preselect == "block" && !BlockHelper.isDefaultSmsApp(context))
    }
    val defaultSmsLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            if (BlockHelper.isDefaultSmsApp(context)) blockSelected = true
        }

    LaunchedEffect(Unit) {
        if (quickScamReport && reportSelected && reportOptions.any { it.reportedLabel == "Scam" }) showDialog = true
    }

    if (showDefaultSmsPrompt) {
        AlertDialog(
            onDismissRequest = { showDefaultSmsPrompt = false },
            containerColor = SurfaceElevated,
            shape = RoundedCornerShape(20.dp),
            title = {
                Text(stringResource(R.string.default_sms_prompt_title), color = White, fontWeight = FontWeight.Bold)
            },
            text = {
                Text(
                    stringResource(R.string.default_sms_prompt_block),
                    color = TextSecondary,
                    fontSize = TextSize.Subhead,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    showDefaultSmsPrompt = false
                    runCatching { defaultSmsLauncher.launch(BlockHelper.defaultSmsAppIntent(context)) }
                }) {
                    Text(
                        stringResource(R.string.default_sms_prompt_confirm),
                        color = Indigo,
                        fontWeight = FontWeight.Bold,
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { showDefaultSmsPrompt = false }) {
                    Text(stringResource(R.string.action_not_now), color = TextSecondary)
                }
            },
        )
    }

    val dialogType =
        when {
            reportSelected && blockSelected -> "both"
            reportSelected -> "report_only"
            blockSelected -> "block_only"
            else -> "none"
        }

    fun proceedAfterConfirm() {
        showDialog = false
        navController.navigate(Screen.ReportSent.createRoute(dialogType))
    }

    if (showDialog && dialogType != "none") {
        ConfirmationDialog(
            type = dialogType,
            sender = sender,
            isSubmitting = isSubmitting,
            onDismiss = { showDialog = false },
            onConfirm = {
                val reportedLabel = reportOptions.getOrNull(selectedReportType)?.reportedLabel
                isSubmitting = true
                coroutineScope.launch {
                    val result =
                        performTakeAction(
                            context,
                            TakeActionRequest(
                                reportSelected = reportSelected,
                                blockSelected = blockSelected,
                                messageId = messageId,
                                localMessageId = localMessageId,
                                sender = sender,
                                reportedLabel = reportedLabel,
                                notes = notes,
                            ),
                        )
                    isSubmitting = false
                    result
                        .onSuccess { proceedAfterConfirm() }
                        .onFailure { error ->
                            if (error is NotDefaultSmsAppException) {
                                showDialog = false
                                showDefaultSmsPrompt = true
                            } else {
                                Toast
                                    .makeText(
                                        context,
                                        error.message ?: context.getString(R.string.error_generic),
                                        Toast.LENGTH_LONG,
                                    ).show()
                            }
                        }
                }
            },
        )
    }

    TakeActionContent(
        canReport = canReport,
        canBlock = canBlock,
        reportOptions = reportOptions,
        reportSelected = reportSelected,
        blockSelected = blockSelected,
        selectedReportType = selectedReportType,
        notes = notes,
        onToggleReport = { reportSelected = !reportSelected },
        onToggleBlock = {
            if (!blockSelected && !BlockHelper.isDefaultSmsApp(context)) {
                showDefaultSmsPrompt = true
            } else {
                blockSelected = !blockSelected
            }
        },
        onSelectReportType = { selectedReportType = it },
        onNotesChange = { notes = it },
        onSubmit = { showDialog = true },
        onBack = navController::popBackStack,
    )
}

@Composable
@Suppress("LongMethod", "LongParameterList") // one flat list of hoisted state + callbacks
private fun TakeActionContent(
    canReport: Boolean,
    canBlock: Boolean,
    reportOptions: List<ReportOption>,
    reportSelected: Boolean,
    blockSelected: Boolean,
    selectedReportType: Int,
    notes: String,
    onToggleReport: () -> Unit,
    onToggleBlock: () -> Unit,
    onSelectReportType: (Int) -> Unit,
    onNotesChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onBack: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black)
                // The notes box sits at the bottom of the form; without this the
                // keyboard covered it (edge-to-edge means adjustResize no longer
                // shrinks the window). The scroll area shrinks instead and the
                // focused field is scrolled into view.
                .imePadding(),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 4.dp, vertical = 4.dp),
        ) {
            IconButton(
                onClick = onBack,
                modifier = Modifier.align(Alignment.CenterStart),
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.action_back),
                    tint = White,
                )
            }
            Text(
                stringResource(if (canBlock) R.string.take_action_title else R.string.take_action_title_report),
                color = White,
                fontWeight = FontWeight.SemiBold,
                fontSize = TextSize.Headline,
                modifier = Modifier.align(Alignment.Center),
            )
        }

        // iOS grouped-list layout: small caps section headers over rounded
        // cards, a check circle for each choice, one primary button at the end.
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 12.dp),
        ) {
            SectionHeader(stringResource(R.string.take_action_choose_an_action))
            GroupCard {
                ActionRow(
                    icon = Icons.Outlined.ReportGmailerrorred,
                    tint = Indigo,
                    title = stringResource(R.string.message_detail_report_message),
                    subtitle =
                        stringResource(
                            if (canReport) {
                                R.string.take_action_report_subtitle
                            } else {
                                R.string.take_action_report_unavailable
                            },
                        ),
                    selected = reportSelected,
                    enabled = canReport,
                    onClick = onToggleReport,
                )
                if (canBlock) {
                    RowDivider()
                    ActionRow(
                        icon = Icons.Outlined.Block,
                        tint = Danger,
                        title = stringResource(R.string.alert_block_sender),
                        subtitle = stringResource(R.string.take_action_stop_messages_from_this_number),
                        selected = blockSelected,
                        onClick = onToggleBlock,
                    )
                }
            }

            if (reportSelected) {
                SectionHeader(stringResource(R.string.take_action_what_is_this_message))
                ReportTypeSection(reportOptions, selectedReportType, onSelectReportType)
                SectionHeader(stringResource(R.string.take_action_notes_optional))
                NotesSection(notes, onNotesChange)
            }

            if (blockSelected) {
                Text(
                    stringResource(R.string.take_action_this_number_will_be_added),
                    color = TextSecondary,
                    fontSize = TextSize.Footnote,
                    lineHeight = 18.sp,
                    modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 8.dp),
                )
            }
        }

        val buttonText =
            when {
                reportSelected && blockSelected -> "Report & Block"
                blockSelected -> "Block Sender"
                else -> "Send Report"
            }
        ActionButton(
            text = buttonText,
            // Blocking is the destructive half, so it takes the red fill.
            color = if (blockSelected) Danger else Indigo,
            enabled = reportSelected || blockSelected,
            onClick = onSubmit,
        )
    }
}

@Composable
private fun SectionHeader(text: String) {
    Text(
        text.uppercase(),
        color = TextSecondary,
        fontSize = TextSize.Caption,
        letterSpacing = 0.4.sp,
        modifier = Modifier.padding(start = 16.dp, top = 20.dp, bottom = 6.dp),
    )
}

@Composable
private fun GroupCard(content: @Composable () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(SurfaceElevated),
    ) { content() }
}

@Composable
private fun RowDivider(startInset: Int = 60) {
    HorizontalDivider(color = Hairline, thickness = 0.5.dp, modifier = Modifier.padding(start = startInset.dp))
}

@Composable
private fun SelectionIndicator(selected: Boolean) {
    Icon(
        if (selected) Icons.Filled.CheckCircle else Icons.Outlined.Circle,
        contentDescription = stringResource(if (selected) R.string.cd_selected else R.string.cd_not_selected),
        tint = if (selected) Indigo else TextTertiary,
        modifier = Modifier.size(22.dp),
    )
}

@Composable
@Suppress("LongParameterList")
private fun ActionRow(
    icon: ImageVector,
    tint: Color,
    title: String,
    subtitle: String,
    selected: Boolean,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .alpha(if (enabled) 1f else DISABLED_CARD_ALPHA)
                .clickable(enabled = enabled, onClick = onClick)
                .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Small tinted tile around the glyph, like an iOS Settings row.
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .background(tint.copy(alpha = 0.14f), RoundedCornerShape(8.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(18.dp))
        }
        Spacer(Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = White, fontSize = TextSize.Body)
            Text(subtitle, color = TextSecondary, fontSize = TextSize.Footnote)
        }
        SelectionIndicator(selected)
    }
}

@Composable
private fun ReportTypeSection(
    options: List<ReportOption>,
    selectedType: Int,
    onSelect: (Int) -> Unit,
) {
    GroupCard {
        options.forEachIndexed { index, option ->
            val isSelected = selectedType == index
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clickable { onSelect(index) }
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    stringResource(option.title),
                    color = White,
                    fontSize = TextSize.Body,
                    modifier = Modifier.weight(1f),
                )
                // iOS picker style: a plain checkmark on the chosen row only.
                if (isSelected) {
                    Icon(
                        Icons.Filled.Check,
                        contentDescription = stringResource(R.string.take_action_selected),
                        tint = Indigo,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }
            if (index != options.lastIndex) RowDivider(startInset = 16)
        }
    }
}

private const val NOTES_MAX_LENGTH = 500

@Composable
private fun NotesSection(
    notes: String,
    onNotesChange: (String) -> Unit,
) {
    Column {
        OutlinedTextField(
            value = notes,
            onValueChange = { if (it.length <= NOTES_MAX_LENGTH) onNotesChange(it) },
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 96.dp),
            placeholder = {
                Text(
                    stringResource(R.string.take_action_anything_that_helps_us_review),
                    color = TextSecondary,
                )
            },
            shape = RoundedCornerShape(14.dp),
            colors =
                OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Color.Transparent,
                    unfocusedBorderColor = Color.Transparent,
                    focusedContainerColor = SurfaceElevated,
                    unfocusedContainerColor = SurfaceElevated,
                    focusedTextColor = White,
                    unfocusedTextColor = White,
                    cursorColor = Indigo,
                ),
        )
        Text(
            "${notes.length}/$NOTES_MAX_LENGTH",
            color = TextSecondary,
            fontSize = TextSize.Caption2,
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp, end = 8.dp),
            textAlign = TextAlign.End,
        )
    }
}

@Composable
private fun ActionButton(
    text: String,
    color: Color,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier =
            Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp, vertical = 12.dp)
                .heightIn(min = 50.dp),
        shape = RoundedCornerShape(14.dp),
        colors =
            ButtonDefaults.buttonColors(
                containerColor = color,
                disabledContainerColor = color.copy(alpha = 0.3f),
                contentColor = OnAccent,
                disabledContentColor = OnAccent.copy(alpha = 0.7f),
            ),
    ) {
        Text(text, fontWeight = FontWeight.SemiBold, fontSize = TextSize.Body)
    }
}

private data class DialogData(
    val icon: ImageVector,
    val title: String,
    val body: String,
    val confirmText: String,
)

@Composable
@Suppress("LongMethod")
private fun ConfirmationDialog(
    type: String,
    sender: String,
    isSubmitting: Boolean,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    val safeSender = sender.ifBlank { stringResource(R.string.take_action_this_number) }
    val data =
        when (type) {
            "report_only" ->
                DialogData(
                    Icons.Outlined.ReportGmailerrorred,
                    stringResource(R.string.take_action_confirm_report_title),
                    stringResource(R.string.take_action_confirm_report_body),
                    stringResource(R.string.take_action_confirm_report_button),
                )
            "block_only" ->
                DialogData(
                    Icons.Outlined.Block,
                    stringResource(R.string.take_action_confirm_block_title),
                    stringResource(R.string.take_action_confirm_block_body, safeSender),
                    stringResource(R.string.take_action_confirm_block_button),
                )
            else ->
                DialogData(
                    Icons.Outlined.Block,
                    stringResource(R.string.take_action_confirm_both_title),
                    stringResource(R.string.take_action_confirm_both_body),
                    stringResource(R.string.take_action_confirm_both_button),
                )
        }
    val accent = if (type == "report_only") Indigo else Danger
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = SurfaceElevated,
        shape = RoundedCornerShape(20.dp),
        icon = { Icon(data.icon, contentDescription = null, tint = accent, modifier = Modifier.size(28.dp)) },
        title = {
            Text(
                data.title,
                color = White,
                fontWeight = FontWeight.SemiBold,
                fontSize = TextSize.Headline,
                textAlign = TextAlign.Center,
            )
        },
        text = {
            Text(data.body, color = TextSecondary, fontSize = TextSize.Footnote, textAlign = TextAlign.Center)
        },
        confirmButton = {
            TextButton(onClick = onConfirm, enabled = !isSubmitting) {
                Text(
                    if (isSubmitting) "Sending…" else data.confirmText,
                    color = accent,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.action_cancel), color = TextSecondary)
            }
        },
    )
}
