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
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.bantai.R
import com.bantai.ui.components.BantAILogo
import com.bantai.ui.components.FeatureListRow
import com.bantai.ui.components.GroupedCard
import com.bantai.ui.components.GroupedDivider
import com.bantai.ui.components.PrimaryButton
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White
import com.bantai.viewmodel.OnboardingViewModel

@Composable
fun OnboardingProtectedScreen(
    viewModel: OnboardingViewModel,
    onFinish: () -> Unit,
) {
    val context = LocalContext.current
    var visible by remember { mutableStateOf(false) }
    var notificationsAllowed by remember {
        mutableStateOf(
            Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
                ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.POST_NOTIFICATIONS,
                ) == PackageManager.PERMISSION_GRANTED,
        )
    }
    val notificationPermissionLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            notificationsAllowed = granted
        }
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
    LaunchedEffect(Unit) {
        visible = true
        if (!notificationsAllowed && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black)
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp)
                .graphicsLayer {
                    alpha = slideAlpha
                    translationY = slideOffsetY
                },
    ) {
        Spacer(Modifier.height(56.dp))

        Box(
            modifier = Modifier.fillMaxWidth(),
            contentAlignment = Alignment.Center,
        ) {
            BantAILogo(size = 64.dp)
        }
        Spacer(Modifier.height(24.dp))

        Text(
            stringResource(R.string.onboarding_protected_you_re_protected),
            fontWeight = FontWeight.Bold,
            fontSize = 28.sp,
            color = White,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        Text(
            stringResource(R.string.onboarding_protected_bantai_is_now_monitoring_your),
            fontSize = TextSize.Subhead,
            color = TextSecondary,
            textAlign = TextAlign.Center,
            lineHeight = 19.sp,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(40.dp))

        GroupedCard {
            FeatureListRow(
                icon = Icons.Filled.Shield,
                title = stringResource(R.string.onboarding_protected_real_time_detection),
                subtitle = stringResource(R.string.onboarding_protected_every_sms_checked_instantly),
            )
            GroupedDivider()
            FeatureListRow(
                icon = Icons.Default.AutoAwesome,
                title = stringResource(R.string.onboarding_protected_on_device_protection),
                subtitle = stringResource(R.string.onboarding_protected_privacy_preserving_threat_checks),
            )
            GroupedDivider()
            FeatureListRow(
                icon = Icons.Default.Hub,
                title = stringResource(R.string.onboarding_protected_campaign_intelligence),
                subtitle = stringResource(R.string.onboarding_protected_track_coordinated_attack_waves),
            )
        }

        if (!notificationsAllowed && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Spacer(Modifier.height(16.dp))
            Text(
                stringResource(R.string.onboarding_protected_threat_notifications_are_off_you),
                fontSize = TextSize.Caption,
                color = TextSecondary,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        Spacer(Modifier.weight(1f))

        PrimaryButton(
            text = stringResource(R.string.onboarding_protected_open_bantai),
            onClick = { viewModel.completeOnboarding(onSuccess = onFinish) },
        )
        Spacer(Modifier.height(24.dp))
    }
}
