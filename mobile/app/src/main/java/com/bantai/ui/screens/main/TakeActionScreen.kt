package com.bantai.ui.screens.main

import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.data.local.UserPreferences
import com.bantai.data.remote.ReportsApi
import com.bantai.navigation.Screen
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.BorderColor
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.White
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

private val reportTypes = listOf("Smishing / Phishing", "Spam", "Wrong classification", "Other")

// Maps a report-type selection to the backend's SubmitReportDto.reportedLabel
// (Ham/Spam/Scam only, no free-text reason field exists). Only the two
// unambiguous mappings are wired to the real POST /reports call; "Wrong
// classification" and "Other" don't imply a specific corrected label, so
// submitting one would just be a guess written into data that feeds AI
// retraining — those two keep the pre-existing (no-op) confirmation flow
// until there's a real design for what they should report.
private fun reportedLabelFor(reportTypeIndex: Int): String? =
    when (reportTypeIndex) {
        0 -> "Scam" // Smishing / Phishing
        1 -> "Spam"
        else -> null // Wrong classification / Other — ambiguous, not wired
    }

private suspend fun submitReport(
    context: Context,
    messageId: String,
    reportedLabel: String,
): Result<Unit> {
    val token = UserPreferences(context).userData.first().authToken
    if (token.isEmpty()) return Result.failure(Exception("Sign in to submit a report"))
    return ReportsApi.submit(token, messageId, reportedLabel)
}

/**
 * @param messageId backend `SmsMessage` UUID for the message being reported — required
 *   for a real submission. Blank when the caller doesn't have one (see NavGraph.kt),
 *   in which case Report falls back to the old confirm-only, no-op behavior rather
 *   than submitting a fabricated id.
 * @param sender shown in the confirmation dialog; blank falls back to a generic label.
 */
@Composable
fun TakeActionScreen(
    navController: NavController,
    messageId: String = "",
    sender: String = "",
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var reportSelected by remember { mutableStateOf(false) }
    var blockSelected by remember { mutableStateOf(false) }
    var selectedReportType by remember { mutableStateOf(0) }
    var notes by remember { mutableStateOf("") }
    var showDialog by remember { mutableStateOf(false) }
    var isSubmitting by remember { mutableStateOf(false) }

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
                val reportedLabel = reportedLabelFor(selectedReportType)
                if (!reportSelected || reportedLabel == null || messageId.isBlank()) {
                    // Nothing submittable (Block-only, or an ambiguous/unwireable
                    // report type) — same no-op confirmation flow as before.
                    proceedAfterConfirm()
                    return@ConfirmationDialog
                }
                isSubmitting = true
                coroutineScope.launch {
                    val result = submitReport(context, messageId, reportedLabel)
                    isSubmitting = false
                    result
                        .onSuccess { proceedAfterConfirm() }
                        .onFailure { error ->
                            Toast
                                .makeText(context, error.message ?: "Could not submit report", Toast.LENGTH_SHORT)
                                .show()
                        }
                }
            },
        )
    }

    TakeActionContent(
        reportSelected = reportSelected,
        blockSelected = blockSelected,
        selectedReportType = selectedReportType,
        notes = notes,
        onToggleReport = { reportSelected = !reportSelected },
        onToggleBlock = { blockSelected = !blockSelected },
        onSelectReportType = { selectedReportType = it },
        onNotesChange = { notes = it },
        onSubmit = { showDialog = true },
        onBack = navController::popBackStack,
    )
}

@Composable
private fun TakeActionContent(
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
                .background(Black),
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
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = White)
            }
            Text(
                "Take Action",
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp,
                modifier = Modifier.align(Alignment.Center),
            )
        }
        HorizontalDivider(color = Surface)

        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                ActionToggleCard(
                    modifier = Modifier.weight(1f),
                    title = "Report",
                    description = "Flag this message to improve PhishNet's AI",
                    icon = Icons.Default.Flag,
                    iconColor = Danger,
                    selected = reportSelected,
                    selectedBg = Color(0xFF2A0A0A),
                    selectedBorder = Danger,
                    checkColor = Indigo,
                    onClick = onToggleReport,
                )
                ActionToggleCard(
                    modifier = Modifier.weight(1f),
                    title = "Block",
                    description = "Stop receiving messages from this number",
                    icon = Icons.Default.Block,
                    iconColor = if (blockSelected) Safe else TextSecondary,
                    selected = blockSelected,
                    selectedBg = Color(0xFF0A2A0A),
                    selectedBorder = Safe,
                    checkColor = Safe,
                    onClick = onToggleBlock,
                )
            }

            when {
                reportSelected && blockSelected -> {
                    ReportTypeSection(selectedReportType, onSelectReportType)
                    NotesSection(notes, onNotesChange)
                    BlockInfoRow()
                    ActionButton(text = "Submit report & block number", enabled = true, onClick = onSubmit)
                }
                reportSelected -> {
                    ReportTypeSection(selectedReportType, onSelectReportType)
                    NotesSection(notes, onNotesChange)
                    ActionButton(text = "Submit report", enabled = true, onClick = onSubmit)
                }
                blockSelected -> {
                    BlockInfoRow()
                    ActionButton(text = "Block number", enabled = true, onClick = onSubmit)
                }
                else -> {
                    ActionButton(text = "Submit report", enabled = false) {}
                }
            }
        }
    }
}

@Composable
private fun ActionToggleCard(
    modifier: Modifier = Modifier,
    title: String,
    description: String,
    icon: ImageVector,
    iconColor: Color,
    selected: Boolean,
    selectedBg: Color,
    selectedBorder: Color,
    checkColor: Color,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            modifier
                .background(if (selected) selectedBg else Surface, RoundedCornerShape(16.dp))
                .border(
                    if (selected) 2.dp else 1.dp,
                    if (selected) selectedBorder else BorderColor,
                    RoundedCornerShape(16.dp),
                ).clickable(onClick = onClick)
                .padding(16.dp),
    ) {
        if (selected) {
            Icon(
                Icons.Default.CheckCircle,
                contentDescription = null,
                tint = checkColor,
                modifier =
                    Modifier
                        .size(16.dp)
                        .align(Alignment.TopEnd),
            )
        }
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Spacer(Modifier.height(8.dp))
            Icon(icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(24.dp))
            Text(title, color = White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            Text(description, color = TextSecondary, fontSize = 11.sp, textAlign = TextAlign.Center)
        }
    }
}

@Composable
private fun ReportTypeSection(
    selectedType: Int,
    onSelect: (Int) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("add details (optional)", color = TextSecondary, fontSize = 12.sp)
        Text("Report type", color = TextSecondary, fontSize = 12.sp)
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            reportTypes.forEachIndexed { index, type ->
                val isSelected = selectedType == index
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(
                                if (isSelected) Color(0xFF16163A) else Surface,
                                RoundedCornerShape(12.dp),
                            ).clickable { onSelect(index) }
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RadioButton(
                        selected = isSelected,
                        onClick = { onSelect(index) },
                        colors =
                            RadioButtonDefaults.colors(
                                selectedColor = Indigo,
                                unselectedColor = TextSecondary,
                            ),
                    )
                    Text(type, color = White, fontSize = 14.sp)
                }
            }
        }
    }
}

private const val NOTES_MAX_LENGTH = 500

@Composable
private fun NotesSection(
    notes: String,
    onNotesChange: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Additional notes (optional)", color = TextSecondary, fontSize = 12.sp)
        OutlinedTextField(
            value = notes,
            onValueChange = { if (it.length <= NOTES_MAX_LENGTH) onNotesChange(it) },
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 80.dp),
            placeholder = { Text("Scammer", color = TextSecondary) },
            shape = RoundedCornerShape(12.dp),
            colors =
                OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Indigo,
                    unfocusedBorderColor = Color.Transparent,
                    focusedContainerColor = Surface,
                    unfocusedContainerColor = Surface,
                    cursorColor = Indigo,
                ),
        )
        Text(
            "${notes.length}/$NOTES_MAX_LENGTH",
            color = TextSecondary,
            fontSize = 11.sp,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.End,
        )
    }
}

@Composable
private fun BlockInfoRow() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(Color(0xFF0A2A0A), RoundedCornerShape(12.dp))
                .padding(12.dp),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Safe, modifier = Modifier.size(18.dp))
        Text(
            "This number will be added to your blocked list and can no longer send you messages. You can unblock anytime in Settings.",
            color = Safe,
            fontSize = 12.sp,
            lineHeight = 18.sp,
        )
    }
}

@Composable
private fun ActionButton(
    text: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier =
            Modifier
                .fillMaxWidth()
                .height(52.dp),
        shape = RoundedCornerShape(12.dp),
        colors =
            ButtonDefaults.buttonColors(
                containerColor = Indigo,
                disabledContainerColor = Color(0xFF3A3A5C),
                contentColor = White,
                disabledContentColor = TextSecondary,
            ),
    ) {
        Text(text, fontWeight = FontWeight.Bold, fontSize = 15.sp)
    }
}

private data class DialogData(
    val icon: ImageVector,
    val title: String,
    val body: String,
    val confirmText: String,
)

@Composable
private fun ConfirmationDialog(
    type: String,
    sender: String,
    isSubmitting: Boolean,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    val safeSender = sender.ifBlank { "This number" }
    val data =
        when (type) {
            "report_only" ->
                DialogData(
                    Icons.Default.Flag,
                    "Submit this report?",
                    "Your report will be sent to the PhishNet team to help improve threat detection for all users.",
                    "Yes, report",
                )
            "block_only" ->
                DialogData(
                    Icons.Default.Block,
                    "Block this number?",
                    "$safeSender will be added to your blocked list and can no longer send you messages. " +
                        "You can unblock it anytime in Settings.",
                    "Yes, block",
                )
            else ->
                DialogData(
                    Icons.Default.Flag,
                    "Submit report & block?",
                    "Your report will be sent to the PhishNet team and the number will be blocked from sending you messages.",
                    "Yes, submit & block",
                )
        }
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Surface,
        shape = RoundedCornerShape(20.dp),
        icon = { Icon(data.icon, contentDescription = null, tint = Danger, modifier = Modifier.size(32.dp)) },
        title = {
            Text(data.title, color = White, fontWeight = FontWeight.Bold, fontSize = 18.sp, textAlign = TextAlign.Center)
        },
        text = {
            Text(data.body, color = TextSecondary, fontSize = 13.sp, textAlign = TextAlign.Center)
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                enabled = !isSubmitting,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Danger),
            ) {
                Text(if (isSubmitting) "Submitting…" else data.confirmText, color = White)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = TextSecondary)
            }
        },
    )
}
