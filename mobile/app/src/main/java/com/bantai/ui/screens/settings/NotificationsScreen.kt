package com.bantai.ui.screens.settings

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import com.bantai.ui.components.LocalBottomBarClearance
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.BorderColor
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.OnIndigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White
import com.bantai.viewmodel.SettingsViewModel

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
    val deliveryReports by viewModel.deliveryReports.collectAsState()
    val context = LocalContext.current

    Column(modifier = Modifier.fillMaxSize().background(Black)) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 4.dp, vertical = 4.dp),
        ) {
            IconButton(
                onClick = { navController.popBackStack() },
                modifier = Modifier.align(Alignment.CenterStart),
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.action_back),
                    tint = White,
                )
            }
            Text(
                stringResource(R.string.notifications_notifications),
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = TextSize.Headline,
                modifier = Modifier.align(Alignment.Center),
            )
        }
        HorizontalDivider(color = Surface)

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
                        subtitle = stringResource(R.string.notifications_high_priority_alert_for_likely),
                        checked = smishingAlerts,
                        onCheckedChange = { viewModel.toggleSmishingAlerts(it) },
                    )
                    HorizontalDivider(color = BorderColor, thickness = 1.dp)
                    ToggleRow(
                        title = stringResource(R.string.notifications_suspicious_alerts),
                        subtitle = stringResource(R.string.notifications_alert_for_messages_worth_a),
                        checked = suspiciousAlerts,
                        onCheckedChange = { viewModel.toggleSuspiciousAlerts(it) },
                    )
                    HorizontalDivider(color = BorderColor, thickness = 1.dp)
                    ToggleRow(
                        title = stringResource(R.string.notifications_spam_alerts),
                        subtitle = stringResource(R.string.notifications_notify_when_a_promo_is),
                        checked = spamAlerts,
                        onCheckedChange = { viewModel.toggleSpamAlerts(it) },
                    )
                    HorizontalDivider(color = BorderColor, thickness = 1.dp)
                    ToggleRow(
                        title = stringResource(R.string.notifications_auto_block_notice),
                        subtitle = stringResource(R.string.notifications_when_a_number_is_blocked),
                        checked = autoBlockNotice,
                        onCheckedChange = { viewModel.toggleAutoBlockNotice(it) },
                    )
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
private fun ToggleRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                // The whole row is the switch: TalkBack reads the title with
                // its on/off state as one item. The Switch below used to be a
                // second, unlabelled stop ("switch, off").
                .toggleable(value = checked, role = Role.Switch, onValueChange = onCheckedChange)
                .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = White, fontWeight = FontWeight.Bold, fontSize = TextSize.Subhead)
            Text(subtitle, color = TextSecondary, fontSize = TextSize.Caption)
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
    Text(
        text,
        color = TextSecondary,
        fontSize = TextSize.Caption2,
        fontWeight = FontWeight.Medium,
        letterSpacing = 1.sp,
        modifier = Modifier.padding(top = 4.dp, start = 4.dp),
    )
}
