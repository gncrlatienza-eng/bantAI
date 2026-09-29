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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.automirrored.filled.Article
import androidx.compose.material.icons.automirrored.filled.Help
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
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.BuildConfig
import com.bantai.data.remote.ApiConfig
import com.bantai.navigation.Screen
import com.bantai.ui.theme.AvatarTeal
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.GlassStroke
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.OnAccent
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.ThemeMode
import com.bantai.ui.theme.White
import com.bantai.ui.theme.isDark
import com.bantai.viewmodel.SettingsViewModel

@Composable
fun SettingsScreen(
    innerPadding: PaddingValues,
    navController: NavController,
    viewModel: SettingsViewModel,
) {
    val userData by viewModel.userData.collectAsState()
    val scanPeriod by viewModel.scanPeriod.collectAsState()
    val themeMode by viewModel.themeMode.collectAsState()
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
    var developerOptionsExpanded by rememberSaveable { mutableStateOf(false) }

    if (showSignOutDialog) {
        AlertDialog(
            onDismissRequest = { showSignOutDialog = false },
            title = { Text("Sign out?", color = White, fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "You'll need to verify your email again to sign back in.",
                    color = TextSecondary,
                    fontSize = TextSize.Subhead,
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showSignOutDialog = false
                        viewModel.signOut {
                            navController.navigate("splash") {
                                popUpTo(navController.graph.id) { inclusive = true }
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Danger),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text("Sign out", color = OnAccent, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showSignOutDialog = false }) {
                    Text("Cancel", color = TextSecondary)
                }
            },
            containerColor = SurfaceElevated,
        )
    }

    if (showScanPeriodDialog) {
        AlertDialog(
            onDismissRequest = { showScanPeriodDialog = false },
            containerColor = SurfaceElevated,
            title = { Text("Scan period", color = White, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "Choose how far back BantAI scans your messages for threats.",
                        color = TextSecondary,
                        fontSize = TextSize.Footnote,
                    )
                    Spacer(Modifier.height(8.dp))
                    listOf(
                        "daily" to "Today only",
                        "weekly" to "Last 7 days",
                        "monthly" to "Last 30 days",
                    ).forEach { (value, label) ->
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
                        if (value != "monthly") {
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
            title = { Text("Simulate incoming SMS", color = White, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        "Debug-only: feeds a message straight into the same detection " +
                            "pipeline a real SMS would, for testing/demos.",
                        color = TextSecondary,
                        fontSize = TextSize.Caption,
                    )
                    OutlinedTextField(
                        value = simSender,
                        onValueChange = { simSender = it },
                        label = { Text("Sender") },
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
                        label = { Text("Message body") },
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
                    Text("Simulate", color = OnAccent, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showSimulateSmsDialog = false }) {
                    Text("Close", color = TextSecondary)
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
            title = { Text("ONNX latency benchmark", color = White, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        "Debug-only, on-device-AI feasibility spike: times the exported model's " +
                            "forward pass on this phone using dummy input, not real tokenization. " +
                            "Says nothing about accuracy — push model_int8.onnx to the app's " +
                            "external files dir first (adb push).",
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
                    Text("Run", color = OnAccent, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showOnnxBenchmarkDialog = false }) {
                    Text("Close", color = TextSecondary)
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
            title = { Text("Backend connection", color = White, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(ApiConfig.BASE_URL, color = White, fontSize = TextSize.Footnote)
                    Text(
                        "Debug-only. Set at build time to this laptop's LAN IP — the phone must be " +
                            "on the same wifi, with the backend running. If unreachable after " +
                            "switching networks, rebuild and reinstall the app.",
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
                    Text("Check again", color = OnAccent, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showBackendCheckDialog = false }) {
                    Text("Close", color = TextSecondary)
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
        // The 16dp gap matches the other tabs, so the title doesn't jump
        // when switching to this tab.
        Spacer(Modifier.height(16.dp))
        Text(
            "Settings",
            color = White,
            fontWeight = FontWeight.Bold,
            fontSize = TextSize.LargeTitle,
            modifier = Modifier.padding(horizontal = 20.dp),
        )

        // Profile hero -- centered photo + name, not a list row, matching the
        // reference's "You" tab: the profile is the top of the page, not one
        // item on it.
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
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
        }

        LazyColumn(
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
                SettingsGroup("Appearance") {
                    DarkModeRow(
                        checked = themeMode.isDark(),
                        onCheckedChange = { dark ->
                            viewModel.setThemeMode(if (dark) ThemeMode.DARK else ThemeMode.LIGHT)
                        },
                    )
                }
            }

            item {
                SettingsGroup("Notifications") {
                    SettingsRow(
                        icon = Icons.Filled.Notifications,
                        title = "Notifications",
                        onClick = { navController.navigate(Screen.SettingsNotifications.route) },
                    )
                    RowDivider()
                    SettingsRow(
                        icon = Icons.Filled.Schedule,
                        title = "Scan period",
                        value = scanPeriodLabel(scanPeriod),
                        onClick = { showScanPeriodDialog = true },
                    )
                    RowDivider()
                    SettingsRow(
                        icon = Icons.Filled.Block,
                        title = "Blocked numbers",
                        onClick = { navController.navigate(Screen.BlockedNumbers.route) },
                    )
                }
            }

            item {
                SettingsGroup("Tips") {
                    SettingsRow(
                        icon = Icons.AutoMirrored.Filled.Article,
                        title = "Scam awareness tips",
                        onClick = { navController.navigate(Screen.SettingsScamAwareness.route) },
                    )
                    RowDivider()
                    SettingsRow(
                        icon = Icons.Filled.Psychology,
                        title = "How BantAI works",
                        onClick = { navController.navigate(Screen.SettingsHowItWorks.route) },
                    )
                }
            }

            item {
                SettingsGroup("Privacy & Support") {
                    SettingsRow(
                        icon = Icons.Filled.Lock,
                        title = "Privacy & data",
                        onClick = { navController.navigate(Screen.SettingsPrivacy.route) },
                    )
                    RowDivider()
                    SettingsRow(
                        icon = Icons.AutoMirrored.Filled.Help,
                        title = "Contact support",
                        onClick = {
                            val intent =
                                Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:support@bantai.ph")).apply {
                                    putExtra(Intent.EXTRA_SUBJECT, "BantAI support request")
                                }
                            runCatching { context.startActivity(intent) }
                        },
                    )
                }
            }

            // Developer options — debug builds only, never ships in a release
            // build. One collapsed parent row so the tools don't crowd the
            // everyday settings above.
            if (BuildConfig.DEBUG) {
                item {
                    SettingsGroup("Developer") {
                        SettingsRow(
                            icon = Icons.Filled.Code,
                            title = "Developer options",
                            onClick = { developerOptionsExpanded = !developerOptionsExpanded },
                            trailingIcon =
                                if (developerOptionsExpanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                        )
                        AnimatedVisibility(visible = developerOptionsExpanded) {
                            Column {
                                RowDivider()
                                SettingsRow(
                                    icon = Icons.Filled.Wifi,
                                    title = "Backend connection",
                                    onClick = { showBackendCheckDialog = true },
                                    indented = true,
                                )
                                RowDivider()
                                SettingsRow(
                                    icon = Icons.Filled.BugReport,
                                    title = "Simulate incoming SMS",
                                    onClick = { showSimulateSmsDialog = true },
                                    indented = true,
                                )
                                RowDivider()
                                SettingsRow(
                                    icon = Icons.Filled.Speed,
                                    title = "ONNX latency benchmark",
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
                    Text("Sign Out", color = Danger, fontWeight = FontWeight.Medium, fontSize = TextSize.Body)
                }
            }

            // Version footer
            item {
                Text(
                    "BantAI v${BuildConfig.VERSION_NAME} · Android ${Build.VERSION.RELEASE}",
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
    value: String? = null,
    trailingIcon: ImageVector = Icons.AutoMirrored.Filled.ArrowForwardIos,
    indented: Boolean = false,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(start = if (indented) 32.dp else 16.dp, end = 16.dp, top = 14.dp, bottom = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = TextTertiary, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(12.dp))
        Text(
            title,
            color = White,
            fontWeight = FontWeight.Medium,
            fontSize = TextSize.Subhead,
            modifier = Modifier.weight(1f),
        )
        if (value != null) {
            Text(value, color = TextSecondary, fontSize = TextSize.Footnote)
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

// A small caps heading over one rounded card of rows -- iOS Settings' inset
// grouped style.
@Composable
private fun SettingsGroup(
    title: String,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column {
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

// Inset to the row text (16dp padding + 18dp icon + 12dp gap), as in iOS.
@Composable
private fun RowDivider() {
    HorizontalDivider(color = Hairline, thickness = 0.5.dp, modifier = Modifier.padding(start = 46.dp))
}

// Same row shape as SettingsRow, with a switch in place of the chevron --
// matches the toggles on the Notifications page.
@Composable
private fun DarkModeRow(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable { onCheckedChange(!checked) }
                .padding(start = 16.dp, end = 12.dp, top = 6.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            Icons.Outlined.DarkMode,
            contentDescription = null,
            tint = TextTertiary,
            modifier = Modifier.size(18.dp),
        )
        Spacer(Modifier.width(12.dp))
        Text(
            "Dark mode",
            color = White,
            fontWeight = FontWeight.Medium,
            fontSize = TextSize.Subhead,
            modifier = Modifier.weight(1f),
        )
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors =
                SwitchDefaults.colors(
                    checkedThumbColor = OnAccent,
                    checkedTrackColor = Indigo,
                    checkedBorderColor = Indigo,
                    uncheckedThumbColor = OnAccent,
                    uncheckedTrackColor = Hairline,
                    uncheckedBorderColor = Hairline,
                ),
        )
    }
}

private fun scanPeriodLabel(period: String): String =
    when (period) {
        "weekly" -> "Last 7 days"
        "monthly" -> "Last 30 days"
        else -> "Today only"
    }
