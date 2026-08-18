package com.bantai.ui.screens.onboarding

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.EaseOutCubic
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.ui.components.OnboardingHeader
import com.bantai.ui.components.PillTextField
import com.bantai.ui.components.PrimaryButton
import com.bantai.ui.components.SectionLabel
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.White
import com.bantai.viewmodel.OnboardingViewModel

private const val STAGGER_DURATION_MS = 420
private const val AVATAR_COLOR_TWEEN_MS = 280
private const val SLIDE_OFFSET_DIVISOR = 6
private const val AVATAR_PULSE_SCALE = 1.12f
private const val AVATAR_REST_SCALE = 1f
private const val NAME_MAX_LENGTH = 30
private const val AVATAR_SIZE_DP = 96

private const val DELAY_HEADER_MS = 0
private const val DELAY_AVATAR_MS = 90
private const val DELAY_FIRST_NAME_MS = 160
private const val DELAY_LAST_NAME_MS = 220
private const val DELAY_ACTIONS_MS = 280

private fun staggeredEnter(delayMillis: Int): EnterTransition =
    fadeIn(tween(STAGGER_DURATION_MS, delayMillis = delayMillis, easing = EaseOutCubic)) +
        slideInVertically(
            animationSpec = tween(STAGGER_DURATION_MS, delayMillis = delayMillis, easing = EaseOutCubic),
            initialOffsetY = { it / SLIDE_OFFSET_DIVISOR },
        )

@Composable
fun OnboardingProfileScreen(
    navController: NavController,
    viewModel: OnboardingViewModel,
    onNext: () -> Unit,
) {
    val firstName by viewModel.firstName.collectAsState()
    val lastName by viewModel.lastName.collectAsState()
    val avatarColorHex by viewModel.avatarColor.collectAsState()
    val state by viewModel.state.collectAsState()

    // Computed from the collected firstName/lastName State directly (rather than
    // calling viewModel.getInitials(), which reads internal fields Compose can't
    // observe from inside a nested AnimatedVisibility scope) so the avatar's
    // initial updates live as the user types instead of lagging a recomposition behind.
    val initials =
        remember(firstName, lastName) {
            val first = firstName.trim().firstOrNull()?.uppercase() ?: ""
            val last = lastName.trim().firstOrNull()?.uppercase() ?: ""
            "$first$last".ifEmpty { "?" }
        }

    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { visible = true }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black)
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = 24.dp),
    ) {
        Spacer(Modifier.height(8.dp))
        ProfileBackButton(onClick = navController::popBackStack)
        Spacer(Modifier.height(24.dp))

        AnimatedVisibility(visible = visible, enter = staggeredEnter(DELAY_HEADER_MS)) {
            OnboardingHeader(
                eyebrow = "Almost there",
                title = "Set up your profile",
                subtitle = "This is how BantAI will address you — kept on this device, never shared.",
            )
        }
        Spacer(Modifier.height(40.dp))

        AnimatedVisibility(
            visible = visible,
            enter = staggeredEnter(DELAY_AVATAR_MS),
            modifier = Modifier.fillMaxWidth(),
        ) {
            ProfileAvatar(initials = initials, avatarColorHex = avatarColorHex, onTap = viewModel::cycleAvatarColor)
        }

        Spacer(Modifier.height(40.dp))

        ProfileNameFields(visible = visible, viewModel = viewModel)

        Spacer(Modifier.weight(1f))

        AnimatedVisibility(visible = visible, enter = staggeredEnter(DELAY_ACTIONS_MS)) {
            ProfileActions(
                errorMessage = state.errorMessage,
                isLoading = state.isLoading,
                onContinue = { viewModel.validateAndSaveProfile(onSuccess = onNext) },
            )
        }
    }
}

@Composable
private fun ProfileBackButton(onClick: () -> Unit) {
    IconButton(onClick = onClick) {
        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = White)
    }
}

@Composable
private fun ProfileNameFields(
    visible: Boolean,
    viewModel: OnboardingViewModel,
) {
    val firstName by viewModel.firstName.collectAsState()
    val lastName by viewModel.lastName.collectAsState()
    val firstNameError by viewModel.firstNameError.collectAsState()
    val firstNameErrorMessage by viewModel.firstNameErrorMessage.collectAsState()
    val lastNameError by viewModel.lastNameError.collectAsState()
    val lastNameErrorMessage by viewModel.lastNameErrorMessage.collectAsState()

    AnimatedVisibility(visible = visible, enter = staggeredEnter(DELAY_FIRST_NAME_MS)) {
        ProfileNameField(
            label = "First name",
            value = firstName,
            onValueChange = { if (it.length <= NAME_MAX_LENGTH) viewModel.updateFirstName(it) },
            placeholder = "e.g. Maria",
            errorMessage = firstNameErrorMessage.takeIf { firstNameError },
        )
    }
    Spacer(Modifier.height(20.dp))

    AnimatedVisibility(visible = visible, enter = staggeredEnter(DELAY_LAST_NAME_MS)) {
        ProfileNameField(
            label = "Last name (optional)",
            value = lastName,
            onValueChange = { if (it.length <= NAME_MAX_LENGTH) viewModel.updateLastName(it) },
            placeholder = "e.g. Santos",
            errorMessage = lastNameErrorMessage.takeIf { lastNameError },
        )
    }
}

@Composable
private fun ProfileActions(
    errorMessage: String?,
    isLoading: Boolean,
    onContinue: () -> Unit,
) {
    Column {
        if (errorMessage != null) {
            Text(errorMessage, fontSize = 12.sp, color = Danger)
            Spacer(Modifier.height(12.dp))
        }
        PrimaryButton(
            text = if (isLoading) "Saving..." else "Continue",
            onClick = onContinue,
            enabled = !isLoading,
            isLoading = isLoading,
        )
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun ProfileAvatar(
    initials: String,
    avatarColorHex: String,
    onTap: () -> Unit,
) {
    val avatarColor =
        remember(avatarColorHex) {
            Color(android.graphics.Color.parseColor(avatarColorHex))
        }
    val animatedAvatarColor by animateColorAsState(
        targetValue = avatarColor,
        animationSpec = tween(AVATAR_COLOR_TWEEN_MS),
        label = "avatar_color",
    )

    var avatarTapped by remember { mutableStateOf(false) }
    var avatarPulse by remember { mutableStateOf(false) }
    val avatarScale by animateFloatAsState(
        targetValue = if (avatarPulse) AVATAR_PULSE_SCALE else AVATAR_REST_SCALE,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow),
        label = "avatar_scale",
        finishedListener = { if (avatarPulse) avatarPulse = false },
    )

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(AVATAR_SIZE_DP.dp)
                    .graphicsLayer {
                        scaleX = avatarScale
                        scaleY = avatarScale
                    }.background(animatedAvatarColor, CircleShape)
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                    ) {
                        onTap()
                        avatarTapped = true
                        avatarPulse = true
                    },
            contentAlignment = Alignment.Center,
        ) {
            Text(initials, color = White, fontSize = 32.sp, fontWeight = FontWeight.Bold)
        }
        Text(
            if (avatarTapped) "Looking good" else "Tap to change color",
            color = TextSecondary,
            fontSize = 12.sp,
        )
    }
}

@Composable
private fun ProfileNameField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    errorMessage: String?,
) {
    var focused by remember { mutableStateOf(false) }
    Column {
        SectionLabel(label)
        Spacer(Modifier.height(8.dp))
        PillTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.onFocusChanged { focused = it.isFocused },
            placeholder = placeholder,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
        )
        if (errorMessage != null) {
            Spacer(Modifier.height(4.dp))
            Text(errorMessage, color = Danger, fontSize = 12.sp)
        }
        if (focused) {
            Spacer(Modifier.height(4.dp))
            Text(
                "${value.length}/$NAME_MAX_LENGTH",
                color = TextSecondary,
                fontSize = 11.sp,
                textAlign = TextAlign.End,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
