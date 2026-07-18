package com.bantai.ui.screens.settings

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
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
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
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.navigation.Screen
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.BorderColor
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.TextSecondary
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

    val avatarColorParsed = remember(userData.avatarColor) {
        try { Color(android.graphics.Color.parseColor(userData.avatarColor)) }
        catch (e: Exception) { Color(0xFF00BCD4) }
    }
    val initials = remember(userData.firstName, userData.lastName) {
        buildString {
            userData.firstName.firstOrNull()?.let { append(it.uppercaseChar()) }
            userData.lastName.firstOrNull()?.let { append(it.uppercaseChar()) }
        }.ifEmpty { "?" }
    }
    val fullName = "${userData.firstName} ${userData.lastName}".trim().ifEmpty { "Your Name" }

    var showDeleteDialog by remember { mutableStateOf(false) }
    var showSmsMonitoringDialog by remember { mutableStateOf(false) }
    var showPhoneDialog by remember { mutableStateOf(false) }
    var showContactSupportDialog by remember { mutableStateOf(false) }
    var showScanPeriodDialog by remember { mutableStateOf(false) }

    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Delete account?", color = White, fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "This will permanently delete your account and all data. This cannot be undone.",
                    color = TextSecondary,
                    fontSize = 14.sp,
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showDeleteDialog = false
                        viewModel.deleteAccount {
                            navController.navigate("splash") {
                                popUpTo(navController.graph.id) { inclusive = true }
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Danger),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text("Delete", color = White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) {
                    Text("Cancel", color = TextSecondary)
                }
            },
            containerColor = Color(0xFF1A1A1A),
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
                    Text("OK", color = Color(0xFF5B4FE8), fontWeight = FontWeight.Bold)
                }
            },
            containerColor = Color(0xFF1A1A1A),
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
                    Text("OK", color = Color(0xFF5B4FE8), fontWeight = FontWeight.Bold)
                }
            },
            containerColor = Color(0xFF1A1A1A),
        )
    }

    if (showContactSupportDialog) {
        AlertDialog(
            onDismissRequest = { showContactSupportDialog = false },
            title = { Text("Contact support", color = White, fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "For support, email us at support@bantai.ph",
                    color = TextSecondary,
                    fontSize = 14.sp,
                )
            },
            confirmButton = {
                TextButton(onClick = { showContactSupportDialog = false }) {
                    Text("OK", color = Color(0xFF5B4FE8), fontWeight = FontWeight.Bold)
                }
            },
            containerColor = Color(0xFF1A1A1A),
        )
    }

    if (showScanPeriodDialog) {
        AlertDialog(
            onDismissRequest = { showScanPeriodDialog = false },
            containerColor = Color(0xFF1A1A1A),
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
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    viewModel.setScanPeriod(value)
                                    showScanPeriodDialog = false
                                }
                                .padding(vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(label, color = White, fontSize = 14.sp)
                            if (scanPeriod == value) {
                                Icon(
                                    Icons.Default.Check,
                                    contentDescription = null,
                                    tint = Color(0xFF5B4FE8),
                                    modifier = Modifier.size(18.dp),
                                )
                            }
                        }
                        if (value != "monthly") {
                            HorizontalDivider(color = Color(0xFF2A2A2A))
                        }
                    }
                }
            },
            confirmButton = {},
        )
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(Black).statusBarsPadding(),
        contentPadding = PaddingValues(
            start = 16.dp,
            end = 16.dp,
            top = innerPadding.calculateTopPadding() + 24.dp,
            bottom = innerPadding.calculateBottomPadding() + 24.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item {
            Text(
                "Settings",
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = 32.sp,
                modifier = Modifier.padding(bottom = 8.dp),
            )
        }

        // Profile card
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Surface, RoundedCornerShape(16.dp))
                    .clickable { navController.navigate(Screen.SettingsEditProfile.route) }
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(avatarColorParsed),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(initials, color = White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                }
                Spacer(Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(fullName, color = White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Text("Tap to edit profile", color = TextSecondary, fontSize = 13.sp)
                }
                Icon(
                    Icons.AutoMirrored.Filled.ArrowForwardIos,
                    contentDescription = null,
                    tint = Color(0xFF666666),
                    modifier = Modifier.size(16.dp),
                )
            }
        }

        // PROTECTION section
        item { SectionLabel("PROTECTION") }
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Surface, RoundedCornerShape(16.dp)),
            ) {
                SettingsRow(
                    icon = Icons.Filled.Shield,
                    title = "SMS Monitoring",
                    subtitle = "Active — all messages scanned",
                    onClick = { showSmsMonitoringDialog = true },
                )
                HorizontalDivider(color = BorderColor, thickness = 1.dp)
                SettingsRow(
                    icon = Icons.Filled.Notifications,
                    title = "Notifications",
                    subtitle = "Smishing alerts enabled",
                    onClick = { navController.navigate(Screen.SettingsNotifications.route) },
                )
                HorizontalDivider(color = BorderColor, thickness = 1.dp)
                SettingsRow(
                    icon = Icons.Filled.Schedule,
                    title = "Scan period",
                    subtitle = when (scanPeriod) {
                        "weekly" -> "Scanning last 7 days"
                        "monthly" -> "Scanning last 30 days"
                        else -> "Scanning today only"
                    },
                    onClick = { showScanPeriodDialog = true },
                )
                HorizontalDivider(color = BorderColor, thickness = 1.dp)
                SettingsRow(
                    icon = Icons.Filled.Block,
                    title = "Blocked numbers",
                    subtitle = "3 numbers blocked",
                    onClick = { navController.navigate(Screen.BlockedNumbers.route) },
                )
            }
        }

        // LEARN section
        item { SectionLabel("LEARN") }
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Surface, RoundedCornerShape(16.dp)),
            ) {
                SettingsRow(
                    icon = Icons.AutoMirrored.Filled.Article,
                    title = "Scam awareness tips",
                    onClick = { navController.navigate(Screen.SettingsScamAwareness.route) },
                )
                HorizontalDivider(color = BorderColor, thickness = 1.dp)
                SettingsRow(
                    icon = Icons.Filled.Psychology,
                    title = "How BantAI works",
                    onClick = { navController.navigate(Screen.SettingsHowItWorks.route) },
                )
            }
        }

        // ACCOUNT section
        item { SectionLabel("ACCOUNT") }
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Surface, RoundedCornerShape(16.dp)),
            ) {
                SettingsRow(
                    icon = Icons.Filled.Phone,
                    title = "Change phone number",
                    onClick = { showPhoneDialog = true },
                )
                HorizontalDivider(color = BorderColor, thickness = 1.dp)
                SettingsRow(
                    icon = Icons.Filled.Lock,
                    title = "Privacy & data",
                    onClick = { navController.navigate(Screen.SettingsPrivacy.route) },
                )
                HorizontalDivider(color = BorderColor, thickness = 1.dp)
                SettingsRow(
                    icon = Icons.AutoMirrored.Filled.Help,
                    title = "Contact support",
                    onClick = { showContactSupportDialog = true },
                )
            }
        }

        // Delete account — separate card
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Surface, RoundedCornerShape(16.dp))
                    .clickable { showDeleteDialog = true }
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Filled.Delete, contentDescription = null, tint = Danger, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(12.dp))
                Text(
                    "Delete account",
                    color = Danger,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    modifier = Modifier.weight(1f),
                )
                Icon(
                    Icons.AutoMirrored.Filled.ArrowForwardIos,
                    contentDescription = null,
                    tint = Danger,
                    modifier = Modifier.size(16.dp),
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
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 16.dp, bottom = 8.dp),
            )
        }
    }
}

@Composable
private fun SettingsRow(
    icon: ImageVector,
    title: String,
    subtitle: String? = null,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = Color(0xFF8A8A8A), modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            if (subtitle != null) {
                Text(subtitle, color = TextSecondary, fontSize = 12.sp)
            }
        }
        Icon(
            Icons.AutoMirrored.Filled.ArrowForwardIos,
            contentDescription = null,
            tint = Color(0xFF666666),
            modifier = Modifier.size(16.dp),
        )
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text,
        color = Color(0xFF666666),
        fontSize = 11.sp,
        fontWeight = FontWeight.Medium,
        letterSpacing = 1.sp,
        modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
    )
}
