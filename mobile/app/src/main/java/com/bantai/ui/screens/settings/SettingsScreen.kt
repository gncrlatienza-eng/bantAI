package com.bantai.ui.screens.settings

import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.automirrored.filled.Article
import androidx.compose.material.icons.automirrored.filled.Help
import androidx.compose.material.icons.automirrored.outlined.HelpOutline
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.SimCard
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.UnfoldMore
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material.icons.outlined.Cloud
import androidx.compose.material.icons.outlined.CloudDone
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.FormatSize
import androidx.compose.material.icons.outlined.Layers
import androidx.compose.material.icons.outlined.School
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.BuildConfig
import com.bantai.R
import com.bantai.data.model.SCAN_PERIODS
import com.bantai.data.model.SCAN_PERIOD_DAILY
import com.bantai.data.model.SCAN_PERIOD_MONTHLY
import com.bantai.data.model.SCAN_PERIOD_WEEKLY
import com.bantai.data.remote.ApiConfig
import com.bantai.navigation.Screen
import com.bantai.ui.components.CoachIds
import com.bantai.ui.components.LocalCoachMarks
import com.bantai.ui.components.coachTarget
import com.bantai.ui.screens.main.LocalSelectTab
import com.bantai.ui.screens.main.LocalTabActive
import com.bantai.ui.theme.AvatarCoral
import com.bantai.ui.theme.AvatarGreen
import com.bantai.ui.theme.AvatarIndigo
import com.bantai.ui.theme.AvatarOrange
import com.bantai.ui.theme.AvatarPink
import com.bantai.ui.theme.AvatarPurple
import com.bantai.ui.theme.AvatarRed
import com.bantai.ui.theme.AvatarTeal
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.GlassStroke
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.IosBlue
import com.bantai.ui.theme.OnAccent
import com.bantai.ui.theme.OnIndigo
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.SystemGray
import com.bantai.ui.theme.TabTitleTopSpacing
import com.bantai.ui.theme.TextScale
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.ThemeMode
import com.bantai.ui.theme.White
import com.bantai.util.Sim
import com.bantai.util.SimChoice
import com.bantai.viewmodel.ServerStatus
import com.bantai.viewmodel.SettingsViewModel

/** Where Contact support (and the Delete account fallback) send people. */
const val SUPPORT_EMAIL = "bantAI.ph@gmail.com"

@Composable
fun SettingsScreen(
    innerPadding: PaddingValues,
    navController: NavController,
    viewModel: SettingsViewModel,
) {
    val userData by viewModel.userData.collectAsState()
    val scanPeriod by viewModel.scanPeriod.collectAsState()
    val themeMode by viewModel.themeMode.collectAsState()
    val textScale by viewModel.textScale.collectAsState()
    val showScamWavesTab by viewModel.showScamWavesTab.collectAsState()
    val hideUnknown by viewModel.hideUnknown.collectAsState()
    val shareReports by viewModel.shareReports.collectAsState()
    val selectTab = LocalSelectTab.current
    var showReplayConfirm by remember { mutableStateOf(false) }
    if (showReplayConfirm) {
        AlertDialog(
            onDismissRequest = { showReplayConfirm = false },
            containerColor = SurfaceElevated,
            title = {
                Text(
                    stringResource(R.string.settings_replay_confirm_title),
                    color = White,
                    fontWeight = FontWeight.Bold,
                )
            },
            text = {
                Text(
                    stringResource(R.string.settings_replay_confirm_body),
                    color = TextSecondary,
                    fontSize = TextSize.Subhead,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    showReplayConfirm = false
                    viewModel.replayTutorial { selectTab(0) }
                }) {
                    Text(
                        stringResource(R.string.settings_replay_confirm_yes),
                        color = IosBlue,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { showReplayConfirm = false }) {
                    Text(stringResource(R.string.action_cancel), color = TextSecondary)
                }
            },
        )
    }
    val context = LocalContext.current

    val avatarColorParsed =
        remember(userData.avatarColor) {
            try {
                Color(android.graphics.Color.parseColor(userData.avatarColor))
            } catch (e: Exception) {
                AvatarTeal
            }
        }
    val initials =
        remember(userData.firstName, userData.lastName) {
            buildString {
                userData.firstName.firstOrNull()?.let { append(it.uppercaseChar()) }
                userData.lastName.firstOrNull()?.let { append(it.uppercaseChar()) }
            }.ifEmpty { "?" }
        }
    val fullName = "${userData.firstName} ${userData.lastName}".trim().ifEmpty { "Your Name" }

    var showSignOutDialog by remember { mutableStateOf(false) }
    var showScanPeriodDialog by remember { mutableStateOf(false) }
    var showSimulateSmsDialog by remember { mutableStateOf(false) }
    var showOnnxBenchmarkDialog by remember { mutableStateOf(false) }
    var showBackendCheckDialog by remember { mutableStateOf(false) }
    val serverStatus by viewModel.serverStatus.collectAsState()
    val tabActive = LocalTabActive.current
    LaunchedEffect(tabActive) { if (tabActive) viewModel.checkServer() }
    var developerOptionsExpanded by rememberSaveable { mutableStateOf(false) }
    // Theme, accent and text size took most of the screen as three always-open
    // segmented controls; one row with the current choices opens them.
    // Dual-SIM only: the SIM every message goes out on (see SimChoice.sendSlot).
    // Re-read each time the tab comes back (it stays composed), so a SIM put
    // in or taken out since shows up.
    val sims = remember(tabActive) { SimChoice.activeSims(context) }
    var sendSlot by remember(tabActive) { mutableStateOf(SimChoice.sendSlot(context)) }
    var showSendSimDialog by remember { mutableStateOf(false) }

    if (showSendSimDialog) {
        SendSimDialog(
            sims = sims,
            selectedSlot = sendSlot,
            onSelect = { slot ->
                SimChoice.setSendSlot(context, slot)
                sendSlot = slot
                showSendSimDialog = false
            },
            onDismiss = { showSendSimDialog = false },
        )
    }

    if (showSignOutDialog) {
        AlertDialog(
            onDismissRequest = { showSignOutDialog = false },
            title = { Text(stringResource(R.string.settings_sign_out), color = White, fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    stringResource(R.string.settings_you_ll_need_to_verify),
                    color = TextSecondary,
                    fontSize = TextSize.Subhead,
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showSignOutDialog = false
                        viewModel.signOut {
                            navController.navigate(Screen.Welcome.route) {
                                popUpTo(navController.graph.id) { inclusive = true }
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Danger),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text(stringResource(R.string.settings_sign_out_2), color = OnAccent, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showSignOutDialog = false }) {
                    Text(stringResource(R.string.action_cancel), color = TextSecondary)
                }
            },
            containerColor = SurfaceElevated,
        )
    }

    if (showScanPeriodDialog) {
        AlertDialog(
            onDismissRequest = { showScanPeriodDialog = false },
            containerColor = SurfaceElevated,
            title = {
                Text(
                    stringResource(R.string.settings_scan_period),
                    color = White,
                    fontWeight = FontWeight.Bold,
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        stringResource(R.string.settings_choose_how_far_back_bantai),
                        color = TextSecondary,
                        fontSize = TextSize.Footnote,
                    )
                    Spacer(Modifier.height(8.dp))
                    SCAN_PERIODS.forEach { value ->
                        val label = stringResource(scanPeriodLabel(value))
                        Row(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        viewModel.setScanPeriod(value)
                                        showScanPeriodDialog = false
                                    }.padding(vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(label, color = White, fontSize = TextSize.Subhead)
                            if (scanPeriod == value) {
                                Icon(
                                    Icons.Default.Check,
                                    contentDescription = null,
                                    tint = Indigo,
                                    modifier = Modifier.size(18.dp),
                                )
                            }
                        }
                        if (value != SCAN_PERIODS.last()) {
                            HorizontalDivider(color = Hairline)
                        }
                    }
                }
            },
            confirmButton = {},
        )
    }

    if (showSimulateSmsDialog) {
        val simulateStatus by viewModel.simulateStatus.collectAsState()
        var simSender by remember { mutableStateOf("+639171234567") }
        var simBody by remember {
            mutableStateOf("Congratulations! You won a P50,000 GCash prize. Claim now at gcash-claim.example")
        }

        LaunchedEffect(Unit) { viewModel.clearSimulateStatus() }

        AlertDialog(
            onDismissRequest = { showSimulateSmsDialog = false },
            containerColor = SurfaceElevated,
            title = {
                Text(
                    stringResource(R.string.settings_simulate_incoming_sms),
                    color = White,
                    fontWeight = FontWeight.Bold,
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        stringResource(R.string.settings_debug_only_feeds_a_message),
                        color = TextSecondary,
                        fontSize = TextSize.Caption,
                    )
                    OutlinedTextField(
                        value = simSender,
                        onValueChange = { simSender = it },
                        label = { Text(stringResource(R.string.settings_sender)) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        colors =
                            OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Indigo,
                                unfocusedBorderColor = GlassStroke,
                                focusedTextColor = White,
                                unfocusedTextColor = White,
                                focusedLabelColor = Indigo,
                                unfocusedLabelColor = TextSecondary,
                                cursorColor = Indigo,
                            ),
                    )
                    OutlinedTextField(
                        value = simBody,
                        onValueChange = { simBody = it },
                        label = { Text(stringResource(R.string.settings_message_body)) },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 3,
                        colors =
                            OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Indigo,
                                unfocusedBorderColor = GlassStroke,
                                focusedTextColor = White,
                                unfocusedTextColor = White,
                                focusedLabelColor = Indigo,
                                unfocusedLabelColor = TextSecondary,
                                cursorColor = Indigo,
                            ),
                    )
                    if (simulateStatus != null) {
                        Text(simulateStatus!!, color = Indigo, fontSize = TextSize.Caption)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { viewModel.simulateIncomingSms(simSender, simBody) },
                    colors = ButtonDefaults.buttonColors(containerColor = Indigo),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text(stringResource(R.string.settings_simulate), color = OnIndigo, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showSimulateSmsDialog = false }) {
                    Text(stringResource(R.string.action_close), color = TextSecondary)
                }
            },
        )
    }

    if (showOnnxBenchmarkDialog) {
        val benchmarkStatus by viewModel.onnxBenchmarkStatus.collectAsState()

        LaunchedEffect(Unit) { viewModel.clearOnnxBenchmarkStatus() }

        AlertDialog(
            onDismissRequest = { showOnnxBenchmarkDialog = false },
            containerColor = SurfaceElevated,
            title = {
                Text(
                    stringResource(R.string.settings_onnx_latency_benchmark),
                    color = White,
                    fontWeight = FontWeight.Bold,
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        stringResource(R.string.settings_debug_only_on_device_ai),
                        color = TextSecondary,
                        fontSize = TextSize.Caption,
                    )
                    if (benchmarkStatus != null) {
                        Text(benchmarkStatus!!, color = Indigo, fontSize = TextSize.Caption)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { viewModel.runOnnxBenchmark() },
                    colors = ButtonDefaults.buttonColors(containerColor = Indigo),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text(stringResource(R.string.settings_run), color = OnIndigo, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showOnnxBenchmarkDialog = false }) {
                    Text(stringResource(R.string.action_close), color = TextSecondary)
                }
            },
        )
    }

    if (showBackendCheckDialog) {
        val backendCheckStatus by viewModel.backendCheckStatus.collectAsState()

        LaunchedEffect(Unit) {
            viewModel.clearBackendCheckStatus()
            viewModel.checkBackendConnection()
        }

        AlertDialog(
            onDismissRequest = { showBackendCheckDialog = false },
            containerColor = SurfaceElevated,
            title = {
                Text(
                    stringResource(R.string.settings_backend_connection),
                    color = White,
                    fontWeight = FontWeight.Bold,
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(ApiConfig.BASE_URL, color = White, fontSize = TextSize.Footnote)
                    Text(
                        stringResource(R.string.settings_debug_only_set_at_build),
                        color = TextSecondary,
                        fontSize = TextSize.Caption,
                    )
                    if (backendCheckStatus != null) {
                        Text(backendCheckStatus!!, color = Indigo, fontSize = TextSize.Caption)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { viewModel.checkBackendConnection() },
                    colors = ButtonDefaults.buttonColors(containerColor = Indigo),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text(stringResource(R.string.settings_check_again), color = OnIndigo, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showBackendCheckDialog = false }) {
                    Text(stringResource(R.string.action_close), color = TextSecondary)
                }
            },
        )
    }

    Column(
        modifier = Modifier.fillMaxSize().background(Black).statusBarsPadding(),
    ) {
        // Same big-title placement as Messages/Alerts/Campaigns -- this tab
        // shouldn't be the odd one out just because the profile hero sits
        // right below it. Pinned above the scrolling list along with the
        // profile hero, rather than scrolling away with everything else.
        // TabTitleTopSpacing matches the other tabs, so the title doesn't
        // jump when switching to this tab.
        Spacer(Modifier.height(TabTitleTopSpacing))
        Text(
            stringResource(R.string.settings_settings),
            color = White,
            fontWeight = FontWeight.Bold,
            fontSize = TextSize.LargeTitle,
            modifier = Modifier.padding(horizontal = 20.dp).coachTarget(CoachIds.SETTINGS_TITLE),
        )

        // Profile hero -- centered photo + name, not a list row, matching the
        // reference's "You" tab: the profile is the top of the page, not one
        // item on it.
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    // Gap above: the photo sat right under the "Settings" title
                    // and the page looked cramped.
                    .padding(top = 28.dp)
                    .clickable { navController.navigate(Screen.SettingsEditProfile.route) }
                    .padding(horizontal = 20.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(84.dp)
                        .clip(CircleShape)
                        .background(avatarColorParsed),
                contentAlignment = Alignment.Center,
            ) {
                Text(initials, color = OnAccent, fontWeight = FontWeight.SemiBold, fontSize = 28.sp)
            }
            Spacer(Modifier.height(10.dp))
            Text(fullName, color = White, fontWeight = FontWeight.SemiBold, fontSize = TextSize.Headline)
            // The whole hero opens Edit Profile, but nothing said so.
            Spacer(Modifier.height(8.dp))
            Text(
                stringResource(R.string.edit_profile_edit_profile),
                color = Indigo,
                fontWeight = FontWeight.Medium,
                fontSize = TextSize.Footnote,
                modifier =
                    Modifier
                        .clip(CircleShape)
                        .background(SurfaceElevated)
                        .clickable { navController.navigate(Screen.SettingsEditProfile.route) }
                        .padding(horizontal = 14.dp, vertical = 6.dp),
            )
        }

        // A walkthrough step on a row further down scrolls it into view first.
        val listState = rememberLazyListState()
        val coachStep = LocalCoachMarks.current?.currentTarget
        LaunchedEffect(coachStep) {
            settingsCoachItem(coachStep)?.let { listState.animateScrollToItem(it) }
        }
        LazyColumn(
            state = listState,
            modifier = Modifier.weight(1f),
            contentPadding =
                PaddingValues(
                    start = 20.dp,
                    top = 20.dp,
                    end = 20.dp,
                    bottom = innerPadding.calculateBottomPadding() + 24.dp,
                ),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            // iOS-style inset grouped list: one card per topic, each under a
            // small caps heading, so related settings read as a set.
            item {
                SettingsGroup(stringResource(R.string.settings_group_notifications)) {
                    SettingsRow(
                        icon = Icons.Filled.Notifications,
                        title = stringResource(R.string.notifications_notifications),
                        onClick = { navController.navigate(Screen.SettingsNotifications.route) },
                    )
                    RowDivider()
                    SettingsRow(
                        icon = Icons.Filled.Schedule,
                        title = stringResource(R.string.settings_scan_period),
                        value = stringResource(scanPeriodLabel(scanPeriod)),
                        onClick = { showScanPeriodDialog = true },
                    )
                    if (sims.size > 1) {
                        RowDivider()
                        SettingsRow(
                            icon = Icons.Filled.SimCard,
                            title = stringResource(R.string.settings_sending_sim),
                            value =
                                sendSlot?.let { slot -> sims.firstOrNull { it.slot == slot }?.label }
                                    ?: stringResource(R.string.settings_sending_sim_auto),
                            onClick = { showSendSimDialog = true },
                        )
                    }
                    RowDivider()
                    SettingsRow(
                        icon = Icons.Filled.Block,
                        title = stringResource(R.string.settings_blocked_numbers),
                        onClick = { navController.navigate(Screen.BlockedNumbers.route) },
                    )
                }
            }

            item {
                SettingsGroup(stringResource(R.string.settings_group_appearance)) {
                    // One row each with the current value; tapping opens a small
                    // pop-up menu (iOS Settings' pattern) instead of an expanding
                    // panel of segmented controls.
                    MenuSettingRow(
                        icon = Icons.Outlined.DarkMode,
                        title = stringResource(R.string.settings_theme),
                        options = ThemeMode.entries.map { it to themeLabel(it) },
                        selected = themeMode,
                        onSelect = viewModel::setThemeMode,
                    )
                    RowDivider()
                    MenuSettingRow(
                        icon = Icons.Outlined.FormatSize,
                        title = stringResource(R.string.settings_text_size),
                        options = TextScale.entries.map { it to it.label },
                        selected = textScale,
                        onSelect = viewModel::setTextScale,
                    )
                    RowDivider()
                    SettingsSwitchRow(
                        modifier = Modifier.coachTarget(CoachIds.SETTINGS_WAVES),
                        icon = Icons.Outlined.Layers,
                        title = stringResource(R.string.settings_show_scam_waves),
                        checked = showScamWavesTab,
                        onCheckedChange = viewModel::setShowScamWavesTab,
                    )
                    RowDivider()
                    SettingsSwitchRow(
                        modifier = Modifier.coachTarget(CoachIds.SETTINGS_UNKNOWN),
                        icon = Icons.AutoMirrored.Outlined.HelpOutline,
                        title = stringResource(R.string.settings_hide_unknown),
                        // On = the tab shows, the same direction as Scam Waves above.
                        checked = !hideUnknown,
                        onCheckedChange = { viewModel.setHideUnknown(!it) },
                    )
                }
            }

            item {
                SettingsGroup(
                    stringResource(R.string.settings_group_tips),
                    modifier = Modifier.coachTarget(CoachIds.SETTINGS_TIPS),
                ) {
                    SettingsRow(
                        icon = Icons.AutoMirrored.Filled.Article,
                        title = stringResource(R.string.settings_scam_awareness_tips),
                        onClick = { navController.navigate(Screen.SettingsScamAwareness.createRoute()) },
                    )
                    RowDivider()
                    SettingsRow(
                        icon = Icons.Filled.Psychology,
                        title = stringResource(R.string.settings_how_bantai_works),
                        onClick = { navController.navigate(Screen.SettingsHowItWorks.route) },
                    )
                    RowDivider()
                    SettingsRow(
                        icon = Icons.Outlined.School,
                        title = stringResource(R.string.settings_replay_tutorial),
                        // Straight to Messages, where the walkthrough starts; it
                        // carries on in Alerts and the first Unknown conversation.
                        onClick = { showReplayConfirm = true },
                    )
                }
            }

            item {
                SettingsGroup(stringResource(R.string.settings_group_privacy)) {
                    ServerConnectionRow(status = serverStatus, onCheck = viewModel::checkServer)
                    RowDivider()
                    SettingsRow(
                        icon = Icons.Filled.Lock,
                        title = stringResource(R.string.privacy_data_privacy_data),
                        onClick = { navController.navigate(Screen.SettingsPrivacy.route) },
                    )
                    RowDivider()
                    SettingsRow(
                        modifier = Modifier.coachTarget(CoachIds.SETTINGS_SUPPORT),
                        icon = Icons.AutoMirrored.Filled.Help,
                        title = stringResource(R.string.settings_contact_support),
                        onClick = {
                            val intent =
                                Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:$SUPPORT_EMAIL")).apply {
                                    putExtra(Intent.EXTRA_SUBJECT, context.getString(R.string.settings_support_subject))
                                }
                            runCatching { context.startActivity(intent) }
                        },
                    )
                    RowDivider()
                    // On: reports go to the team and can train the AI. Off:
                    // nothing is reported, flagged texts offer Block only.
                    SettingsSwitchRow(
                        modifier = Modifier.coachTarget(CoachIds.SETTINGS_SHARE_REPORTS),
                        icon = Icons.Outlined.Flag,
                        title = stringResource(R.string.settings_share_reports),
                        checked = shareReports,
                        onCheckedChange = viewModel::setShareReports,
                    )
                }
            }

            // Developer options — debug builds only, never ships in a release
            // build. One collapsed parent row so the tools don't crowd the
            // everyday settings above.
            if (BuildConfig.DEBUG) {
                item {
                    SettingsGroup(stringResource(R.string.settings_group_developer)) {
                        SettingsRow(
                            icon = Icons.Filled.Code,
                            title = stringResource(R.string.settings_developer_options),
                            onClick = { developerOptionsExpanded = !developerOptionsExpanded },
                            trailingIcon =
                                if (developerOptionsExpanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                        )
                        AnimatedVisibility(visible = developerOptionsExpanded) {
                            Column {
                                RowDivider()
                                SettingsRow(
                                    icon = Icons.Filled.Wifi,
                                    title = stringResource(R.string.settings_backend_connection),
                                    onClick = { showBackendCheckDialog = true },
                                    indented = true,
                                )
                                RowDivider()
                                SettingsRow(
                                    icon = Icons.Filled.BugReport,
                                    title = stringResource(R.string.settings_simulate_incoming_sms),
                                    onClick = { showSimulateSmsDialog = true },
                                    indented = true,
                                )
                                RowDivider()
                                SettingsRow(
                                    icon = Icons.Filled.Speed,
                                    title = stringResource(R.string.settings_onnx_latency_benchmark),
                                    onClick = { showOnnxBenchmarkDialog = true },
                                    indented = true,
                                )
                            }
                        }
                    }
                }
            }

            // Sign out -- its own card, centered red text like iOS's destructive
            // rows. Not "Delete account": there is no backend account-deletion
            // endpoint yet, only this local session clear.
            item {
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(SurfaceElevated, RoundedCornerShape(18.dp))
                            .clickable { showSignOutDialog = true }
                            .padding(vertical = 14.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        stringResource(R.string.settings_sign_out_3),
                        color = Danger,
                        fontWeight = FontWeight.Medium,
                        fontSize = TextSize.Body,
                    )
                }
            }

            // Version footer
            item {
                Text(
                    stringResource(R.string.settings_version, BuildConfig.VERSION_NAME, Build.VERSION.RELEASE),
                    color = TextSecondary,
                    fontSize = TextSize.Caption2,
                    textAlign = TextAlign.Center,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(top = 16.dp, bottom = 8.dp),
                )
            }
        }
    }
}

@Composable
@Suppress("LongParameterList") // all but the first three are optional styling defaults
private fun SettingsRow(
    icon: ImageVector,
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    value: String? = null,
    trailingIcon: ImageVector = Icons.AutoMirrored.Filled.ArrowForwardIos,
    indented: Boolean = false,
    valueColor: Color = TextSecondary,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .heightIn(min = 48.dp)
                .padding(start = if (indented) 32.dp else 16.dp, end = 16.dp, top = 10.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        SettingsIconTile(icon)
        Spacer(Modifier.width(12.dp))
        Text(
            title,
            color = White,
            fontSize = TextSize.Body,
            modifier = Modifier.weight(1f),
        )
        if (value != null) {
            // Capped and shortened with "…": a long value ("Dark · Purple ·
            // Default") used to squeeze the title into a one-word-per-line column.
            Text(
                value,
                color = valueColor,
                fontSize = TextSize.Footnote,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.End,
                modifier = Modifier.padding(start = 8.dp).widthIn(max = 170.dp),
            )
            Spacer(Modifier.width(8.dp))
        }
        // A chevron glyph fills its box; expand/collapse arrows need a larger box to match its weight.
        val isChevron = trailingIcon == Icons.AutoMirrored.Filled.ArrowForwardIos
        Icon(
            trailingIcon,
            contentDescription = null,
            tint = TextTertiary,
            modifier = Modifier.size(if (isChevron) 14.dp else 20.dp),
        )
    }
}

// A row that is a switch: tapping anywhere flips it, and TalkBack reads the
// title with its on/off state as one item.
@Composable
private fun SettingsSwitchRow(
    icon: ImageVector,
    title: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .toggleable(value = checked, role = Role.Switch, onValueChange = onCheckedChange)
                .heightIn(min = 48.dp)
                .padding(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        SettingsIconTile(icon)
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = White, fontSize = TextSize.Body)
        }
        Spacer(Modifier.width(12.dp))
        Switch(
            checked = checked,
            onCheckedChange = null,
            colors = SwitchDefaults.colors(checkedThumbColor = OnIndigo, checkedTrackColor = Indigo),
        )
    }
}

// A small caps heading over one rounded card of rows -- iOS Settings' inset
// grouped style.
@Composable
private fun SettingsGroup(
    title: String,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(modifier) {
        Text(
            title.uppercase(),
            color = TextSecondary,
            fontSize = TextSize.Caption,
            letterSpacing = 0.4.sp,
            modifier = Modifier.padding(start = 16.dp, bottom = 6.dp),
        )
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(SurfaceElevated, RoundedCornerShape(18.dp)),
            content = content,
        )
    }
}

// The list item (one per group) a walkthrough step needs on screen.
private fun settingsCoachItem(step: String?): Int? =
    when (step) {
        CoachIds.SETTINGS_TITLE -> ITEM_NOTIFICATIONS
        CoachIds.SETTINGS_WAVES, CoachIds.SETTINGS_UNKNOWN -> ITEM_APPEARANCE
        CoachIds.SETTINGS_TIPS -> ITEM_TIPS
        CoachIds.SETTINGS_SUPPORT, CoachIds.SETTINGS_SHARE_REPORTS -> ITEM_PRIVACY
        else -> null
    }

// The list's items, in order: one per group.
private const val ITEM_NOTIFICATIONS = 0
private const val ITEM_APPEARANCE = 1
private const val ITEM_TIPS = 2
private const val ITEM_PRIVACY = 3

// Inset to the row text (16dp padding + 28dp tile + 12dp gap), as in iOS.
@Composable
private fun RowDivider() {
    HorizontalDivider(color = Hairline, thickness = 0.5.dp, modifier = Modifier.padding(start = 56.dp))
}

// iOS Settings' small colored square behind each row's glyph: rows can be
// found by color at a glance, and the page stops reading as one grey list.
@Composable
private fun SettingsIconTile(icon: ImageVector) {
    Box(
        modifier = Modifier.size(28.dp).background(settingsTileColor(icon), RoundedCornerShape(7.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = null, tint = OnAccent, modifier = Modifier.size(17.dp))
    }
}

// One color per kind of setting, picked like iOS: red for alerts, green for
// the SIM, purple for looks, grey for privacy and developer tools.
private fun settingsTileColor(icon: ImageVector): Color {
    val name = icon.name.substringAfterLast('.')
    return when (name) {
        "Notifications" -> AvatarRed
        "Schedule" -> AvatarIndigo
        "SimCard" -> AvatarGreen
        "Block" -> AvatarCoral
        "Palette", "DarkMode" -> AvatarPurple
        "FormatSize" -> AvatarIndigo
        "Layers", "Article" -> AvatarOrange
        "HelpOutline", "Lock", "Code", "Wifi", "BugReport", "Speed" -> SystemGray
        "Psychology" -> AvatarPink
        "School" -> AvatarTeal
        else -> AvatarIndigo
    }
}

// Automatic / Light / Dark. This was an on/off Dark switch, so once flipped
// there was no way back to following the phone.
// A setting with a few fixed choices: the row shows the current one, and a tap
// opens a small menu with a check on it.
@Composable
@Suppress("LongParameterList") // the row, its choices, then the callback
private fun <T> MenuSettingRow(
    icon: ImageVector,
    title: String,
    options: List<Pair<T, Int>>,
    selected: T,
    onSelect: (T) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    val current = options.firstOrNull { it.first == selected }?.second
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable { open = true }
                .heightIn(min = 48.dp)
                .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        SettingsIconTile(icon)
        Spacer(Modifier.width(12.dp))
        Text(title, color = White, fontSize = TextSize.Body, modifier = Modifier.weight(1f))
        Box {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (current != null) Text(stringResource(current), color = TextSecondary, fontSize = TextSize.Body)
                Icon(
                    Icons.Filled.UnfoldMore,
                    contentDescription = null,
                    tint = TextTertiary,
                    modifier = Modifier.size(18.dp),
                )
            }
            DropdownMenu(
                expanded = open,
                onDismissRequest = { open = false },
                containerColor = SurfaceElevated,
                shape = RoundedCornerShape(14.dp),
            ) {
                options.forEach { (value, label) ->
                    DropdownMenuItem(
                        text = { Text(stringResource(label), color = White, fontSize = TextSize.Body) },
                        trailingIcon = {
                            if (value == selected) {
                                Icon(
                                    Icons.Filled.Check,
                                    contentDescription = null,
                                    tint = Indigo,
                                    modifier = Modifier.size(18.dp),
                                )
                            }
                        },
                        onClick = {
                            open = false
                            onSelect(value)
                        },
                    )
                }
            }
        }
    }
}

private fun themeLabel(mode: ThemeMode): Int =
    when (mode) {
        ThemeMode.SYSTEM -> R.string.settings_theme_automatic
        ThemeMode.LIGHT -> R.string.settings_theme_light
        ThemeMode.DARK -> R.string.settings_theme_dark
    }

private fun scanPeriodLabel(period: String): Int =
    when (period) {
        SCAN_PERIOD_DAILY -> R.string.settings_scan_today
        SCAN_PERIOD_WEEKLY -> R.string.settings_scan_week
        SCAN_PERIOD_MONTHLY -> R.string.settings_scan_month
        else -> R.string.settings_scan_all
    }

// Automatic (null) or one SIM slot, styled like the Scan period picker.
@Composable
private fun SendSimDialog(
    sims: List<Sim>,
    selectedSlot: Int?,
    onSelect: (Int?) -> Unit,
    onDismiss: () -> Unit,
) {
    val automatic = stringResource(R.string.settings_sending_sim_auto)
    val options = listOf<Pair<Int?, String>>(null to automatic) + sims.map { it.slot to it.label }
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = SurfaceElevated,
        title = { Text(stringResource(R.string.settings_sending_sim), color = White, fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    stringResource(R.string.settings_sending_sim_detail),
                    color = TextSecondary,
                    fontSize = TextSize.Footnote,
                )
                Spacer(Modifier.height(8.dp))
                options.forEachIndexed { index, (slot, label) ->
                    Row(
                        modifier = Modifier.fillMaxWidth().clickable { onSelect(slot) }.padding(vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(label, color = White, fontSize = TextSize.Subhead)
                        if (slot == selectedSlot) {
                            Icon(
                                Icons.Default.Check,
                                contentDescription = null,
                                tint = Indigo,
                                modifier = Modifier.size(18.dp),
                            )
                        }
                    }
                    if (index != options.lastIndex) HorizontalDivider(color = Hairline)
                }
            }
        },
        confirmButton = {},
    )
}

// Whether the app reaches BantAI's server right now. Tap to check again.
@Composable
private fun ServerConnectionRow(
    status: ServerStatus,
    onCheck: () -> Unit,
) {
    val (label, color, icon) =
        when (status) {
            ServerStatus.CHECKING -> Triple(R.string.settings_server_checking, TextSecondary, Icons.Outlined.Cloud)
            ServerStatus.CONNECTED -> Triple(R.string.settings_server_connected, Safe, Icons.Outlined.CloudDone)
            ServerStatus.OFFLINE -> Triple(R.string.settings_server_offline, Danger, Icons.Outlined.CloudOff)
        }
    SettingsRow(
        icon = icon,
        title = stringResource(R.string.settings_server_connection),
        value = stringResource(label),
        valueColor = color,
        onClick = onCheck,
    )
}
