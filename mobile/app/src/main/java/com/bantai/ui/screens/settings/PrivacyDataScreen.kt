package com.bantai.ui.screens.settings

import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.StringRes
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.animateFloatAsState
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Gavel
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.VolunteerActivism
import androidx.compose.material.icons.outlined.DeleteForever
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.container
import com.bantai.data.DataExport
import com.bantai.navigation.Screen
import com.bantai.ui.components.GroupedFooter
import com.bantai.ui.components.GroupedSectionHeader
import com.bantai.ui.components.IosTopBar
import com.bantai.ui.components.LocalBottomBarClearance
import com.bantai.ui.components.groupedItem
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.OnIndigo
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White
import com.bantai.viewmodel.SettingsViewModel
import kotlinx.coroutines.launch

@Composable
@Suppress("LongMethod", "MaxLineLength")
fun PrivacyDataScreen(
    navController: NavController,
    settingsViewModel: SettingsViewModel,
) {
    val context = LocalContext.current
    var confirmDelete by remember { mutableStateOf(false) }
    val deleting by settingsViewModel.deletingAccount.collectAsState()
    val trainingOptIn by settingsViewModel.trainingOptIn.collectAsState()
    val trainingSaving by settingsViewModel.trainingOptInSaving.collectAsState()
    LaunchedEffect(Unit) { settingsViewModel.loadTrainingOptIn() }
    val localShare by context.container.shareReports.collectAsState()
    if (confirmDelete) {
        DeleteAccountDialog(
            deleting = deleting,
            onConfirm = {
                settingsViewModel.deleteAccount(
                    onDeleted = {
                        confirmDelete = false
                        Toast.makeText(context, R.string.delete_account_done, Toast.LENGTH_LONG).show()
                        navController.navigate(Screen.Welcome.route) {
                            popUpTo(navController.graph.id) { inclusive = true }
                        }
                    },
                    onFailed = {
                        Toast
                            .makeText(
                                context,
                                context.getString(R.string.delete_account_failed, SUPPORT_EMAIL),
                                Toast.LENGTH_LONG,
                            ).show()
                    },
                )
            },
            onDismiss = { if (!deleting) confirmDelete = false },
        )
    }
    val scope = rememberCoroutineScope()
    var exporting by remember { mutableStateOf(false) }
    // System "Save as" screen; the user picks where the JSON file goes.
    val exportLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
            if (uri == null) return@rememberLauncherForActivityResult
            exporting = true
            scope.launch {
                val result = DataExport.writeTo(context, uri)
                exporting = false
                Toast
                    .makeText(
                        context,
                        if (result.isSuccess) R.string.privacy_export_done else R.string.privacy_export_failed,
                        Toast.LENGTH_LONG,
                    ).show()
            }
        }

    var openRow by rememberSaveable { mutableStateOf<Int?>(null) }
    val policyRows =
        listOf(
            PolicyRow(
                Icons.Filled.Inventory2,
                R.string.privacy_data_data_we_collect,
                R.string.privacy_summary_collect,
                listOf(R.string.privacy_data_a_server_side_pseudonymous_sender),
            ),
            PolicyRow(
                Icons.Filled.Insights,
                R.string.privacy_data_how_your_data_is_used,
                R.string.privacy_summary_used,
                listOf(R.string.privacy_data_data_supports_privacy_minimized_campaign),
            ),
            PolicyRow(
                Icons.Filled.Schedule,
                R.string.privacy_retention_title,
                R.string.privacy_summary_retention,
                listOf(R.string.privacy_retention_detail, R.string.privacy_data_pseudonymous_threat_telemetry_is_deleted),
            ),
            PolicyRow(
                Icons.Filled.Gavel,
                R.string.privacy_data_your_rights,
                R.string.privacy_summary_rights,
                listOf(R.string.privacy_data_you_can_request_deletion_of),
            ),
        )

    Column(modifier = Modifier.fillMaxSize().background(Black)) {
        IosTopBar(
            title = stringResource(R.string.privacy_data_privacy_data),
            onBack = { navController.popBackStack() },
        )

        // iOS grouped list: a one-line summary per topic, the full wording one
        // tap away, so the page reads in seconds but nothing is hidden.
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            // Bottom clearance matches the floating tab bar's footprint (see
            // MainScreen) -- this screen now renders behind that persistent bar.
            contentPadding = PaddingValues(bottom = LocalBottomBarClearance.current),
        ) {
            item { PrivacyHero() }
            item { GroupedSectionHeader(stringResource(R.string.privacy_section_handling)) }
            itemsIndexed(policyRows) { index, row ->
                Column(Modifier.groupedItem(index, policyRows.lastIndex)) {
                    PolicyRowItem(
                        row = row,
                        expanded = openRow == index,
                        onToggle = { openRow = if (openRow == index) null else index },
                    )
                    if (index != policyRows.lastIndex) RowDivider()
                }
            }

            // Opt-in, off by default: reports, plus a person reviewing masked
            // messages the AI flagged or wasn't sure about (see TrainingConsentPrompt).
            item { GroupedSectionHeader(stringResource(R.string.privacy_section_improve)) }
            item {
                TrainingSwitchRow(
                    // The phone's saved answer while the server's loads (or
                    // offline), so it matches the Report buttons and Reported page.
                    checked = (trainingOptIn ?: localShare) == true,
                    enabled = trainingOptIn != null && !trainingSaving,
                    onCheckedChange = { enabled ->
                        settingsViewModel.setTrainingOptIn(enabled) {
                            Toast.makeText(context, R.string.privacy_training_failed, Toast.LENGTH_LONG).show()
                        }
                    },
                )
            }
            item { GroupedFooter(stringResource(R.string.privacy_training_footer)) }

            item { GroupedSectionHeader(stringResource(R.string.privacy_section_your_data)) }
            item {
                ActionRow(
                    icon = Icons.Filled.Download,
                    label =
                        stringResource(
                            if (exporting) R.string.privacy_export_preparing else R.string.privacy_data_download_my_data,
                        ),
                    tint = Indigo,
                    enabled = !exporting,
                    onClick = {
                        runCatching { exportLauncher.launch(DataExport.suggestedFileName()) }
                            .onFailure {
                                Toast.makeText(context, R.string.privacy_export_failed, Toast.LENGTH_LONG).show()
                            }
                    },
                )
            }
            // Kept apart from Download, and red, so it's never tapped by
            // mistake; the dialog asks the user to type DELETE as well.
            item { Spacer(Modifier.height(28.dp)) }
            item {
                ActionRow(
                    icon = Icons.Outlined.DeleteForever,
                    label = stringResource(R.string.privacy_delete_account),
                    tint = Danger,
                    onClick = { confirmDelete = true },
                )
            }
            item { GroupedFooter(stringResource(R.string.privacy_delete_account_detail)) }
        }
    }
}

private data class PolicyRow(
    val icon: ImageVector,
    @StringRes val title: Int,
    @StringRes val summary: Int,
    val details: List<Int>,
)

@Composable
private fun PrivacyHero() {
    Column(
        modifier = Modifier.fillMaxWidth().padding(start = 32.dp, end = 32.dp, top = 12.dp, bottom = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier.size(56.dp).background(Indigo, RoundedCornerShape(14.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.Shield, contentDescription = null, tint = Color.White, modifier = Modifier.size(30.dp))
        }
        Spacer(Modifier.height(12.dp))
        Text(
            stringResource(R.string.privacy_hero),
            color = TextSecondary,
            fontSize = TextSize.Footnote,
            lineHeight = 18.sp,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun PolicyRowItem(
    row: PolicyRow,
    expanded: Boolean,
    onToggle: () -> Unit,
) {
    val rotation by animateFloatAsState(if (expanded) CHEVRON_OPEN else 0f, label = "chevron")
    Column(Modifier.fillMaxWidth().animateContentSize()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onToggle)
                    .padding(horizontal = 14.dp, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconTile(row.icon, Indigo)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(stringResource(row.title), color = White, fontSize = TextSize.Body)
                Text(
                    stringResource(row.summary),
                    color = TextSecondary,
                    fontSize = TextSize.Caption,
                    lineHeight = 16.sp,
                )
            }
            Spacer(Modifier.width(8.dp))
            Icon(
                Icons.AutoMirrored.Filled.ArrowForwardIos,
                contentDescription = null,
                tint = TextTertiary,
                modifier = Modifier.size(13.dp).rotate(rotation),
            )
        }
        if (expanded) {
            Column(
                modifier = Modifier.padding(start = ROW_INDENT, end = 16.dp, bottom = 14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                row.details.forEach { detail ->
                    Text(
                        stringResource(detail),
                        color = TextSecondary,
                        fontSize = TextSize.Footnote,
                        lineHeight = 19.sp,
                    )
                }
            }
        }
    }
}

@Composable
private fun TrainingSwitchRow(
    checked: Boolean,
    enabled: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .groupedItem(0, 0)
                // The whole row is the switch, so TalkBack reads the title with
                // its on/off state as one item.
                .toggleable(value = checked, enabled = enabled, role = Role.Switch, onValueChange = onCheckedChange)
                .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconTile(Icons.Filled.VolunteerActivism, Safe)
        Spacer(Modifier.width(12.dp))
        Text(
            stringResource(R.string.privacy_training_title),
            color = White,
            fontSize = TextSize.Body,
            modifier = Modifier.weight(1f),
        )
        Spacer(Modifier.width(8.dp))
        Switch(
            checked = checked,
            onCheckedChange = null,
            enabled = enabled,
            colors = SwitchDefaults.colors(checkedThumbColor = OnIndigo, checkedTrackColor = Indigo),
        )
    }
}

@Composable
private fun ActionRow(
    icon: ImageVector,
    label: String,
    tint: Color,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .groupedItem(0, 0)
                .fillMaxWidth()
                .clickable(enabled = enabled, onClick = onClick)
                .padding(horizontal = 14.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(12.dp))
        Text(label, color = tint, fontSize = TextSize.Body)
    }
}

// iOS Settings-style icon: a small solid tile with a white glyph.
@Composable
private fun IconTile(
    icon: ImageVector,
    tint: Color,
) {
    Box(
        modifier = Modifier.size(30.dp).background(tint, RoundedCornerShape(8.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
    }
}

@Composable
private fun RowDivider() {
    HorizontalDivider(color = Hairline, thickness = 0.5.dp, modifier = Modifier.padding(start = ROW_INDENT))
}

private const val CHEVRON_OPEN = 90f

// Detail text and dividers line up with the row titles, past the icon tile.
private val ROW_INDENT = 56.dp
