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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bantai.ui.components.AccentIconTile
import com.bantai.ui.components.FeatureListRow
import com.bantai.ui.components.GroupedCard
import com.bantai.ui.components.GroupedDivider
import com.bantai.ui.components.OnboardingHeader
import com.bantai.ui.components.PrimaryButton
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.TextSecondary

@Composable
fun OnboardingDefaultSmsScreen(onNext: () -> Unit) {
    val context = LocalContext.current

    val roleRequestLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
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
        modifier = Modifier
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

        AccentIconTile(icon = Icons.Filled.Shield, size = 56.dp)
        Spacer(Modifier.height(20.dp))

        OnboardingHeader(
            eyebrow = "Step 1 of 4",
            title = "Set as your SMS app",
            subtitle = "BantAI needs to be your default messaging app to read and protect your SMS messages from phishing threats.",
        )

        Spacer(Modifier.height(28.dp))

        GroupedCard {
            FeatureListRow(
                icon = Icons.AutoMirrored.Filled.Message,
                title = "Receive and read",
                subtitle = "Receive and read all SMS messages",
            )
            GroupedDivider()
            FeatureListRow(
                icon = Icons.AutoMirrored.Filled.Send,
                title = "Send messages",
                subtitle = "Send SMS messages on your behalf",
            )
            GroupedDivider()
            FeatureListRow(
                icon = Icons.Filled.Shield,
                title = "Scan for threats",
                subtitle = "Scan messages for smishing threats",
            )
        }

        Spacer(Modifier.weight(1f))

        PrimaryButton(
            text = "Set as default",
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
            modifier = Modifier
                .fillMaxWidth()
                .height(44.dp)
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = ::navigateForward,
                ),
            contentAlignment = Alignment.Center,
        ) {
            Text("Not now", color = TextSecondary, fontSize = 15.sp, fontWeight = FontWeight.Medium)
        }
        Spacer(Modifier.height(16.dp))
    }
}
