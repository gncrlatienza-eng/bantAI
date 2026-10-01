package com.bantai.ui.screens.onboarding

import android.app.role.RoleManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.EaseOutCubic
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Message
import androidx.compose.material.icons.automirrored.filled.Send
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
import androidx.compose.ui.unit.dp
import com.bantai.R
import com.bantai.ui.components.BantAILogo
import com.bantai.ui.components.FeatureListRow
import com.bantai.ui.components.GroupedCard
import com.bantai.ui.components.GroupedDivider
import com.bantai.ui.components.OnboardingHeader
import com.bantai.ui.components.PrimaryButton
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize

@Composable
fun OnboardingDefaultSmsScreen(onNext: () -> Unit) {
    val context = LocalContext.current

    val roleRequestLauncher =
        rememberLauncherForActivityResult(
            ActivityResultContracts.StartActivityForResult(),
        ) {
            onNext()
        }

    fun navigateForward() = onNext()

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
                .padding(horizontal = 20.dp)
                .graphicsLayer {
                    alpha = slideAlpha
                    translationY = slideOffsetY
                },
    ) {
        Spacer(Modifier.height(48.dp))

        BantAILogo(size = 56.dp)
        Spacer(Modifier.height(20.dp))

        OnboardingHeader(
            eyebrow = stringResource(R.string.onboarding_default_sms_step_4_of_5),
            title = stringResource(R.string.onboarding_default_sms_set_as_your_sms_app),
            subtitle = stringResource(R.string.onboarding_default_sms_bantai_needs_to_be_your),
        )

        Spacer(Modifier.height(28.dp))

        GroupedCard {
            FeatureListRow(
                icon = Icons.AutoMirrored.Filled.Message,
                title = stringResource(R.string.onboarding_default_sms_receive_and_read),
                subtitle = stringResource(R.string.onboarding_default_sms_receive_and_read_all_sms),
            )
            GroupedDivider()
            FeatureListRow(
                icon = Icons.AutoMirrored.Filled.Send,
                title = stringResource(R.string.onboarding_default_sms_send_messages),
                subtitle = stringResource(R.string.onboarding_default_sms_send_sms_messages_on_your),
            )
            GroupedDivider()
            FeatureListRow(
                icon = Icons.Filled.Shield,
                title = stringResource(R.string.onboarding_default_sms_scan_for_threats),
                subtitle = stringResource(R.string.onboarding_default_sms_scan_messages_for_smishing_threats),
            )
        }

        Spacer(Modifier.weight(1f))

        PrimaryButton(
            text = stringResource(R.string.default_sms_prompt_confirm),
            onClick = {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val rm = context.getSystemService(RoleManager::class.java)
                    if (rm.isRoleAvailable(RoleManager.ROLE_SMS) && !rm.isRoleHeld(RoleManager.ROLE_SMS)) {
                        roleRequestLauncher.launch(rm.createRequestRoleIntent(RoleManager.ROLE_SMS))
                    } else {
                        navigateForward()
                    }
                } else {
                    navigateForward()
                }
            },
        )
        Spacer(Modifier.height(8.dp))
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 44.dp)
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = ::navigateForward,
                    ),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                stringResource(R.string.action_not_now),
                color = TextSecondary,
                fontSize = TextSize.Body,
                fontWeight = FontWeight.Medium,
            )
        }
        Spacer(Modifier.height(16.dp))
    }
}
