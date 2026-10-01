package com.bantai.ui.screens.onboarding

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.EaseOutCubic
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Sms
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.bantai.R
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.DarkIndigo
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.OnIndigo
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White

@Composable
@Suppress("LongMethod", "MaxLineLength")
fun OnboardingAllowAccessScreen(onNext: () -> Unit) {
    val context = LocalContext.current
    val permissionLauncher =
        rememberLauncherForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions(),
        ) {
            onNext()
        }

    // Becoming the default SMS app on the previous screen usually grants these
    // already; don't ask the user for something they've just given.
    LaunchedEffect(Unit) {
        val needed =
            buildList {
                add(Manifest.permission.READ_SMS)
                add(Manifest.permission.RECEIVE_SMS)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) add(Manifest.permission.POST_NOTIFICATIONS)
            }
        if (needed.all { ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED }) onNext()
    }

    var visible by remember { mutableStateOf(false) }
    val slideAlpha by animateFloatAsState(
        targetValue = if (visible) 1f else 0f,
        animationSpec = tween(durationMillis = 500),
        label = "fade_in",
    )
    val slideOffsetY by animateFloatAsState(
        targetValue = if (visible) 0f else 60f,
        animationSpec = tween(durationMillis = 500, easing = EaseOutCubic),
        label = "slide_up",
    )
    LaunchedEffect(Unit) { visible = true }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black)
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = 24.dp)
                .graphicsLayer {
                    alpha = slideAlpha
                    translationY = slideOffsetY
                },
    ) {
        Spacer(Modifier.height(40.dp))

        Box(
            modifier =
                Modifier
                    .size(48.dp)
                    .background(DarkIndigo, RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.Sms, contentDescription = null, tint = Indigo, modifier = Modifier.size(28.dp))
        }
        Spacer(Modifier.height(16.dp))
        Text(stringResource(R.string.onboarding_allow_access_read_your_sms), fontWeight = FontWeight.Bold, fontSize = TextSize.Title, color = White)
        Spacer(Modifier.height(8.dp))
        Text(
            stringResource(R.string.onboarding_allow_access_bantai_reads_incoming_messages_on),
            fontSize = TextSize.Footnote,
            color = TextSecondary,
            lineHeight = 20.sp,
        )
        Spacer(Modifier.height(32.dp))

        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            PermissionCheckRow(
                icon = Icons.Default.Lock,
                title = stringResource(R.string.onboarding_allow_access_read_sms_messages),
                subtitle = stringResource(R.string.onboarding_allow_access_to_scan_incoming_texts_for),
            )
            PermissionCheckRow(
                icon = Icons.Default.Notifications,
                title = stringResource(R.string.onboarding_allow_access_send_notifications),
                subtitle = stringResource(R.string.onboarding_allow_access_alert_you_when_a_threat),
            )
            PermissionCheckRow(
                icon = Icons.Filled.Shield,
                title = stringResource(R.string.onboarding_allow_access_sms_content_stays_on_your),
                subtitle = stringResource(R.string.onboarding_allow_access_classification_happens_on_device_only),
            )
        }

        Spacer(Modifier.weight(1f))

        Button(
            onClick = {
                val permissions =
                    buildList {
                        add(Manifest.permission.READ_SMS)
                        add(Manifest.permission.RECEIVE_SMS)
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            add(Manifest.permission.POST_NOTIFICATIONS)
                        }
                    }
                permissionLauncher.launch(permissions.toTypedArray())
            },
            modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Indigo),
        ) {
            Text(stringResource(R.string.onboarding_allow_access_allow_sms_access), color = OnIndigo, fontWeight = FontWeight.SemiBold, fontSize = TextSize.Body)
        }
        Spacer(Modifier.height(4.dp))
        TextButton(
            onClick = { onNext() },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(stringResource(R.string.action_skip_for_now), color = TextSecondary, fontSize = TextSize.Subhead)
        }
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun PermissionCheckRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(Surface, RoundedCornerShape(12.dp))
                .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(icon, contentDescription = null, tint = Indigo, modifier = Modifier.size(22.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.Bold, fontSize = TextSize.Subhead, color = White)
            Text(subtitle, fontSize = TextSize.Caption, color = TextSecondary)
        }
        Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = Safe, modifier = Modifier.size(20.dp))
    }
}
