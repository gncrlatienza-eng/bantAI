package com.bantai.ui.screens.settings

import android.Manifest
import android.app.AlarmManager
import android.app.TimePickerDialog
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.text.format.DateFormat
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.GppBad
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.data.DailySummaryScheduler
import com.bantai.ui.components.GroupedRowDivider
import com.bantai.ui.components.IconTile
import com.bantai.ui.components.IosTopBar
import com.bantai.ui.components.LocalBottomBarClearance
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.IosBlue
import com.bantai.ui.theme.OnIndigo
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.SystemGray
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White
import com.bantai.viewmodel.SettingsViewModel
import kotlinx.coroutines.launch

/**
 * One page of notification toggles. Each switch maps to a real check in
 * SmsIngestPipeline.applyServerClassification/applyOfflineCaution:
 * smishing/suspicious off → a plain message notification instead of the
 * high-priority alert; spam off → no notification (still filed to Spam).
 * Sound/vibration per channel is left to the system settings row.
 */
@Composable
fun NotificationsScreen(
    navController: NavController,
    viewModel: SettingsViewModel,
) {
    val smishingAlerts by viewModel.smishingAlerts.collectAsState()
    val suspiciousAlerts by viewModel.suspiciousAlerts.collectAsState()
    val spamAlerts by viewModel.spamAlerts.collectAsState()
    val autoBlockNotice by viewModel.autoBlockNotice.collectAsState()
    val autoBlockScams by viewModel.autoBlockScams.collectAsState()
    val deliveryReports by viewModel.deliveryReports.collectAsState()
    val context = LocalContext.current

    Column(modifier = Modifier.fillMaxSize().background(Black)) {
        IosTopBar(
            title = stringResource(R.string.notifications_notifications),
            onBack = { navController.popBackStack() },
        )

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            // Bottom clearance matches the floating tab bar's footprint (see
            // MainScreen) -- this screen renders behind that persistent bar.
            contentPadding =
                PaddingValues(
                    start = 16.dp,
                    top = 16.dp,
                    end = 16.dp,
                    bottom = LocalBottomBarClearance.current,
                ),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item { NotificationPermissionBanner() }

            item { SectionLabel(stringResource(R.string.notifications_alert_types)) }

            item {
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(Surface, RoundedCornerShape(16.dp)),
                ) {
                    ToggleRow(
                        title = stringResource(R.string.notifications_smishing_alerts),
                        icon = Icons.Filled.GppBad,
                        tint = Danger,
                        subtitle = stringResource(R.string.notifications_high_priority_alert_for_likely),
                        checked = smishingAlerts,
                        onCheckedChange = { viewModel.toggleSmishingAlerts(it) },
                    )
                    GroupedRowDivider()
                    ToggleRow(
                        title = stringResource(R.string.notifications_suspicious_alerts),
                        icon = Icons.Filled.WarningAmber,
                        tint = Suspicious,
                        subtitle = stringResource(R.string.notifications_alert_for_messages_worth_a),
                        checked = suspiciousAlerts,
                        onCheckedChange = { viewModel.toggleSuspiciousAlerts(it) },
                    )
                    GroupedRowDivider()
                    ToggleRow(
                        title = stringResource(R.string.notifications_spam_alerts),
                        icon = Icons.Filled.Campaign,
                        tint = SystemGray,
                        subtitle = stringResource(R.string.notifications_notify_when_a_promo_is),
                        checked = spamAlerts,
                        onCheckedChange = { viewModel.toggleSpamAlerts(it) },
                    )
                    GroupedRowDivider()
                    ToggleRow(
                        title = stringResource(R.string.notifications_auto_block_scams),
                        icon = Icons.Filled.Block,
                        tint = Danger,
                        subtitle = stringResource(R.string.notifications_auto_block_scams_detail),
                        checked = autoBlockScams,
                        onCheckedChange = { viewModel.toggleAutoBlockScams(it) },
                    )
                    // Only meaningful when BantAI blocks on its own.
                    if (autoBlockScams) {
                        GroupedRowDivider()
                        ToggleRow(
                            title = stringResource(R.string.notifications_auto_block_notice),
                            icon = Icons.Filled.NotificationsActive,
                            subtitle = stringResource(R.string.notifications_when_a_number_is_blocked),
                            checked = autoBlockNotice,
                            onCheckedChange = { viewModel.toggleAutoBlockNotice(it) },
                        )
                    }
                }
            }

            item {
                Text(
                    stringResource(R.string.notifications_turning_off_smishing_or_suspicious),
                    color = TextSecondary,
                    fontSize = TextSize.Caption,
                    lineHeight = 16.sp,
                    modifier = Modifier.padding(horizontal = 4.dp),
                )
            }

            item { SectionLabel(stringResource(R.string.summary_settings_section)) }

            item { DailySummarySettings(viewModel) }

            item { SectionLabel(stringResource(R.string.notifications_messages_section)) }

            item {
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(Surface, RoundedCornerShape(16.dp)),
                ) {
                    ToggleRow(
                        title = stringResource(R.string.notifications_delivery_reports),
                        icon = Icons.Filled.DoneAll,
                        tint = Safe,
                        subtitle = stringResource(R.string.notifications_delivery_reports_detail),
                        checked = deliveryReports,
                        onCheckedChange = { viewModel.toggleDeliveryReports(it) },
                    )
                }
            }

            item {
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(Surface, RoundedCornerShape(16.dp))
                            .clickable {
                                val intent =
                                    Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                                        putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                                    }
                                runCatching { context.startActivity(intent) }
                            }.padding(horizontal = 16.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Icons.Filled.Tune,
                        contentDescription = null,
                        tint = TextSecondary,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            stringResource(R.string.notifications_sound_vibration),
                            color = White,
                            fontWeight = FontWeight.Medium,
                            fontSize = TextSize.Subhead,
                        )
                        Text(
                            stringResource(R.string.notifications_managed_in_android_notification_settings),
                            color = TextSecondary,
                            fontSize = TextSize.Caption,
                        )
                    }
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowForwardIos,
                        contentDescription = null,
                        tint = TextSecondary,
                        modifier = Modifier.size(14.dp),
                    )
                }
            }
        }
    }
}

// The toggles only choose which BantAI alerts are sent -- they can't make
// Android deliver anything without the OS-level POST_NOTIFICATIONS
// permission, so surface that gap instead of letting "on" look like it works
// (see NotificationHelper.canPostNotifications).
@Composable
private fun NotificationPermissionBanner() {
    val context = LocalContext.current
    val isGranted = {
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
    }
    var notificationsGranted by remember { mutableStateOf(isGranted()) }
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer =
            LifecycleEventObserver { _, event ->
                if (event == Lifecycle.Event.ON_RESUME) notificationsGranted = isGranted()
            }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    if (notificationsGranted) return
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(Danger.copy(alpha = 0.15f), RoundedCornerShape(12.dp))
                .clickable {
                    val intent =
                        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                            putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                        }
                    runCatching { context.startActivity(intent) }
                }.padding(12.dp),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(Icons.Filled.WarningAmber, contentDescription = null, tint = Suspicious, modifier = Modifier.size(18.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                stringResource(R.string.notifications_notifications_are_off_for_bantai),
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = TextSize.Footnote,
            )
            Text(
                stringResource(R.string.notifications_the_alerts_below_won_t),
                color = TextSecondary,
                fontSize = TextSize.Caption,
                lineHeight = 16.sp,
            )
        }
    }
}

@Composable
@Suppress("LongParameterList") // the row, its switch, and an optional icon tile
private fun ToggleRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    icon: ImageVector? = null,
    tint: Color = Indigo,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                // The whole row is the switch: TalkBack reads the title with
                // its on/off state as one item. The Switch below used to be a
                // second, unlabelled stop ("switch, off").
                .toggleable(value = checked, role = Role.Switch, onValueChange = onCheckedChange)
                .padding(horizontal = 14.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            IconTile(icon, tint)
            Spacer(Modifier.width(12.dp))
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = White, fontSize = TextSize.Body)
            Text(subtitle, color = TextSecondary, fontSize = TextSize.Caption, lineHeight = 16.sp)
        }
        Spacer(Modifier.width(12.dp))
        Switch(
            checked = checked,
            onCheckedChange = null,
            colors =
                SwitchDefaults.colors(
                    checkedThumbColor = OnIndigo,
                    checkedTrackColor = Indigo,
                ),
        )
    }
}

@Composable
private fun SectionLabel(text: String) {
    // Same small caps header as the other grouped screens (GroupedSectionHeader).
    Text(
        text.uppercase(),
        color = TextSecondary,
        fontSize = TextSize.Caption,
        letterSpacing = 0.4.sp,
        modifier = Modifier.padding(top = 10.dp, start = 16.dp),
    )
}

// The evening recap: on/off, and the time it arrives (Android's own time picker).
@Composable
private fun DailySummarySettings(viewModel: SettingsViewModel) {
    val context = LocalContext.current
    val enabled by viewModel.dailySummaryEnabled.collectAsState()
    val minute by viewModel.dailySummaryMinute.collectAsState()
    val timeLabel =
        remember(minute) {
            DateFormat.getTimeFormat(context).format(
                java.util.Calendar
                    .getInstance()
                    .apply {
                        set(java.util.Calendar.HOUR_OF_DAY, minute / MINUTES_PER_HOUR)
                        set(java.util.Calendar.MINUTE, minute % MINUTES_PER_HOUR)
                    }.time,
            )
        }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(Surface, RoundedCornerShape(16.dp)),
    ) {
        ToggleRow(
            title = stringResource(R.string.summary_settings_toggle),
            subtitle = stringResource(R.string.summary_settings_toggle_detail),
            checked = enabled,
            onCheckedChange = { viewModel.setDailySummary(it, minute) },
        )
        if (enabled) {
            HorizontalDivider(color = Hairline, thickness = 0.5.dp)
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clickable {
                            TimePickerDialog(
                                context,
                                { _, hour, min -> viewModel.setDailySummary(true, hour * MINUTES_PER_HOUR + min) },
                                minute / MINUTES_PER_HOUR,
                                minute % MINUTES_PER_HOUR,
                                DateFormat.is24HourFormat(context),
                            ).show()
                        }.padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    stringResource(R.string.summary_settings_time),
                    color = White,
                    fontWeight = FontWeight.Medium,
                    fontSize = TextSize.Subhead,
                    modifier = Modifier.weight(1f),
                )
                Text(timeLabel, color = IosBlue, fontSize = TextSize.Subhead)
            }
            SummaryOnTimeRows()
        }
    }
}

private const val MINUTES_PER_HOUR = 60

// Phone brands whose battery managers stop background apps unless allowed.
private val STRICT_BATTERY_BRANDS =
    setOf("huawei", "honor", "xiaomi", "redmi", "poco", "oppo", "realme", "vivo", "oneplus")

/**
 * What it takes for the recap to arrive on time with BantAI closed. On Android
 * 14+ exact alarms are off until the user allows "Alarms & reminders" (without
 * it the recap comes a few minutes late), and some brands' battery managers stop
 * background apps altogether. Re-checked on every resume; once allowed, the row
 * goes away and the alarm is re-armed exactly.
 */
@Composable
private fun SummaryOnTimeRows() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var exactAllowed by remember { mutableStateOf(canExactAlarm(context)) }
    val owner = LocalLifecycleOwner.current
    DisposableEffect(owner) {
        val observer =
            LifecycleEventObserver { _, event ->
                if (event == Lifecycle.Event.ON_RESUME) {
                    val now = canExactAlarm(context)
                    if (now && !exactAllowed) scope.launch { DailySummaryScheduler.schedule(context) }
                    exactAllowed = now
                }
            }
        owner.lifecycle.addObserver(observer)
        onDispose { owner.lifecycle.removeObserver(observer) }
    }
    if (!exactAllowed && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        HorizontalDivider(color = Hairline, thickness = 0.5.dp)
        OnTimeRow(
            title = stringResource(R.string.summary_exact_title),
            detail = stringResource(R.string.summary_exact_detail),
            action = stringResource(R.string.summary_exact_allow),
        ) {
            val intent =
                Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}"))
            runCatching { context.startActivity(intent) }
        }
    }
    if (Build.MANUFACTURER.lowercase() in STRICT_BATTERY_BRANDS) {
        HorizontalDivider(color = Hairline, thickness = 0.5.dp)
        OnTimeRow(
            title = stringResource(R.string.summary_battery_title),
            detail = stringResource(R.string.summary_battery_detail),
            action = stringResource(R.string.action_open_settings),
        ) {
            val intent =
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
            runCatching { context.startActivity(intent) }
        }
    }
}

private fun canExactAlarm(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
        context.getSystemService(AlarmManager::class.java)?.canScheduleExactAlarms() == true

@Composable
private fun OnTimeRow(
    title: String,
    detail: String,
    action: String,
    onAction: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onAction).padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, color = White, fontWeight = FontWeight.Medium, fontSize = TextSize.Subhead)
            Text(detail, color = TextSecondary, fontSize = TextSize.Caption, lineHeight = 16.sp)
        }
        Spacer(Modifier.width(12.dp))
        Text(action, color = IosBlue, fontSize = TextSize.Subhead)
    }
}
