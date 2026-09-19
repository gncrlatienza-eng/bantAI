package com.bantai.ui.screens.settings

import android.content.Intent
import android.net.Uri
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
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.automirrored.filled.Article
import androidx.compose.material.icons.automirrored.filled.Help
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
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
import com.bantai.navigation.Screen
import com.bantai.ui.theme.AvatarTeal
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.GlassStroke
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White
import com.bantai.viewmodel.SettingsViewModel

@Composable
fun SettingsScreen(
    innerPadding: PaddingValues,
    navController: NavController,
    viewModel: SettingsViewModel,
) {
    val userData by viewModel.userData.collectAsState()
    val scanPeriod by viewModel.scanPeriod.collectAsState()
    val context = LocalContext.current
    val accountDeleteError by viewModel.accountDeleteError.collectAsState()
    val accountDeleting by viewModel.accountDeleting.collectAsState()

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
    var showSmsMonitoringDialog by remember { mutableStateOf(false) }
    var showPhoneDialog by remember { mutableStateOf(false) }
    var showScanPeriodDialog by remember { mutableStateOf(false) }
    var showSimulateSmsDialog by remember { mutableStateOf(false) }
    var showOnnxBenchmarkDialog by remember { mutableStateOf(false) }

    if (showSignOutDialog) {
        AlertDialog(
            onDismissRequest = { showSignOutDialog = false },
            title = { Text("Sign out?", color = White, fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "You'll need to verify your phone number again to sign back in.",
                    color = TextSecondary,
                    fontSize = 14.sp,
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
                    enabled = !accountDeleting,
                    colors = ButtonDefaults.buttonColors(containerColor = Danger),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text("Sign out", color = White, fontWeight = FontWeight.Bold)
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

    if (showSmsMonitoringDialog) {
        AlertDialog(
            onDismissRequest = { showSmsMonitoringDialog = false },
            title = { Text("SMS Monitoring", color = White, fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "SMS Monitoring is always active while BantAI is your default SMS app.",
                    color = TextSecondary,
                    fontSize = 14.sp,
                )
            },
            confirmButton = {
                TextButton(onClick = { showSmsMonitoringDialog = false }) {
                    Text("OK", color = Indigo, fontWeight = FontWeight.Bold)
                }
            },
            containerColor = SurfaceElevated,
        )
    }

    if (showPhoneDialog) {
        AlertDialog(
            onDismissRequest = { showPhoneDialog = false },
            title = { Text("Change phone number", color = White, fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "Phone number change coming in a future update.",
                    color = TextSecondary,
                    fontSize = 14.sp,
                )
            },
            confirmButton = {
                TextButton(onClick = { showPhoneDialog = false }) {
                    Text("OK", color = Indigo, fontWeight = FontWeight.Bold)
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
                        fontSize = 13.sp,
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
                            Text(label, color = White, fontSize = 14.sp)
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
                        fontSize = 12.sp,
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
                        Text(simulateStatus!!, color = Indigo, fontSize = 12.sp)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { viewModel.simulateIncomingSms(simSender, simBody) },
                    colors = ButtonDefaults.buttonColors(containerColor = Indigo),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text("Simulate", color = White, fontWeight = FontWeight.Bold)
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
                        fontSize = 12.sp,
                    )
                    if (benchmarkStatus != null) {
                        Text(benchmarkStatus!!, color = Indigo, fontSize = 12.sp)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { viewModel.runOnnxBenchmark() },
                    colors = ButtonDefaults.buttonColors(containerColor = Indigo),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text("Run", color = White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showOnnxBenchmarkDialog = false }) {
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
        Text(
            "Settings",
            color = White,
            fontWeight = FontWeight.Bold,
            fontSize = 32.sp,
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
                Text(initials, color = White, fontWeight = FontWeight.SemiBold, fontSize = 28.sp)
            }
            Spacer(Modifier.height(10.dp))
            Text(fullName, color = White, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
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
            // Protection + learn -- one grouped card rather than several small
            // labeled ones, matching the reference's "You" tab.
            item {
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(SurfaceElevated, RoundedCornerShape(18.dp)),
                ) {
                    SettingsRow(
                        icon = Icons.Filled.Shield,
                        title = "SMS Monitoring",
                        onClick = { showSmsMonitoringDialog = true },
                    )
                    HorizontalDivider(color = Hairline, thickness = 1.dp)
                    SettingsRow(
                        icon = Icons.Filled.Notifications,
                        title = "Notifications",
                        onClick = { navController.navigate(Screen.SettingsNotifications.route) },
                    )
                    HorizontalDivider(color = Hairline, thickness = 1.dp)
                    SettingsRow(
                        icon = Icons.Filled.Schedule,
                        title = "Scan period",
                        onClick = { showScanPeriodDialog = true },
                    )
                    HorizontalDivider(color = Hairline, thickness = 1.dp)
                    SettingsRow(
                        icon = Icons.Filled.Block,
                        title = "Blocked numbers",
                        onClick = { navController.navigate(Screen.BlockedNumbers.route) },
                    )
                    HorizontalDivider(color = Hairline, thickness = 1.dp)
                    SettingsRow(
                        icon = Icons.AutoMirrored.Filled.Article,
                        title = "Scam awareness tips",
                        onClick = { navController.navigate(Screen.SettingsScamAwareness.route) },
                    )
                    HorizontalDivider(color = Hairline, thickness = 1.dp)
                    SettingsRow(
                        icon = Icons.Filled.Psychology,
                        title = "How BantAI works",
                        onClick = { navController.navigate(Screen.SettingsHowItWorks.route) },
                    )
                }
            }

            // DEVELOPER section — debug builds only, never ships in a release build.
            if (BuildConfig.DEBUG) {
                item {
                    Column(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .background(SurfaceElevated, RoundedCornerShape(18.dp)),
                    ) {
                        SettingsRow(
                            icon = Icons.Filled.BugReport,
                            title = "Simulate incoming SMS",
                            onClick = { showSimulateSmsDialog = true },
                        )
                        HorizontalDivider(color = Hairline, thickness = 1.dp)
                        SettingsRow(
                            icon = Icons.Filled.BugReport,
                            title = "ONNX latency benchmark",
                            onClick = { showOnnxBenchmarkDialog = true },
                        )
                    }
                }
            }

            item {
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(SurfaceElevated, RoundedCornerShape(18.dp)),
                ) {
                    SettingsRow(
                        icon = Icons.Filled.Phone,
                        title = "Change phone number",
                        onClick = { showPhoneDialog = true },
                    )
                    HorizontalDivider(color = Hairline, thickness = 1.dp)
                    SettingsRow(
                        icon = Icons.Filled.Lock,
                        title = "Privacy & data",
                        onClick = { navController.navigate(Screen.SettingsPrivacy.route) },
                    )
                    HorizontalDivider(color = Hairline, thickness = 1.dp)
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

            // Sign out — separate card. Not "Delete account": there is no backend
            // account-deletion endpoint yet, only this local session clear.
            item {
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(SurfaceElevated, RoundedCornerShape(18.dp))
                            .clickable { showSignOutDialog = true }
                            .padding(horizontal = 16.dp, vertical = 13.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null, tint = Danger, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(12.dp))
                    Text(
                        "Sign out",
                        color = Danger,
                        fontWeight = FontWeight.Medium,
                        fontSize = 14.sp,
                        modifier = Modifier.weight(1f),
                    )
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowForwardIos,
                        contentDescription = null,
                        tint = Danger,
                        modifier = Modifier.size(14.dp),
                    )
                }
            }

            // Version footer
            item {
                Text(
                    "BantAI v1.0.0 · SDK 34",
                    color = TextSecondary,
                    fontSize = 11.sp,
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
private fun SettingsRow(
    icon: ImageVector,
    title: String,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = TextTertiary, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(12.dp))
        Text(title, color = White, fontWeight = FontWeight.Medium, fontSize = 14.sp, modifier = Modifier.weight(1f))
        Icon(
            Icons.AutoMirrored.Filled.ArrowForwardIos,
            contentDescription = null,
            tint = TextTertiary,
            modifier = Modifier.size(14.dp),
        )
    }
}
