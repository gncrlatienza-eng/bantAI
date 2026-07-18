package com.bantai.ui.screens.onboarding

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bantai.ui.components.BantAILogo
import com.bantai.ui.components.FeatureListRow
import com.bantai.ui.components.GroupedCard
import com.bantai.ui.components.GroupedDivider
import com.bantai.ui.components.PrimaryButton
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.White
import com.bantai.viewmodel.OnboardingViewModel

@Composable
fun OnboardingProtectedScreen(
    viewModel: OnboardingViewModel,
    onFinish: () -> Unit,
) {
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
        Spacer(Modifier.height(56.dp))

        Box(
            modifier = Modifier.fillMaxWidth(),
            contentAlignment = Alignment.Center,
        ) {
            BantAILogo(containerSize = 64.dp, iconSize = 36.dp)
        }
        Spacer(Modifier.height(24.dp))

        Text(
            "You're protected.",
            fontWeight = FontWeight.Bold,
            fontSize = 28.sp,
            color = White,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        Text(
            "BantAI is now monitoring your incoming messages for smishing threats.",
            fontSize = 14.sp,
            color = TextSecondary,
            textAlign = TextAlign.Center,
            lineHeight = 19.sp,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(40.dp))

        GroupedCard {
            FeatureListRow(
                icon = Icons.Filled.Shield,
                title = "Real-time detection",
                subtitle = "Every SMS checked instantly",
            )
            GroupedDivider()
            FeatureListRow(
                icon = Icons.Default.AutoAwesome,
                title = "AI-powered analysis",
                subtitle = "Trained on Filipino smishing patterns",
            )
            GroupedDivider()
            FeatureListRow(
                icon = Icons.Default.Hub,
                title = "Campaign intelligence",
                subtitle = "Track coordinated attack waves",
            )
        }

        Spacer(Modifier.weight(1f))

        PrimaryButton(
            text = "Open BantAI",
            onClick = { viewModel.completeOnboarding(onSuccess = onFinish) },
        )
        Spacer(Modifier.height(24.dp))
    }
}
