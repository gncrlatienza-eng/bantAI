package com.bantai.ui.screens.onboarding

import androidx.compose.animation.core.EaseOutCubic
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.BorderColor
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.White
import com.bantai.viewmodel.OnboardingViewModel

@Composable
fun OnboardingProfileScreen(
    viewModel: OnboardingViewModel,
    onNext: () -> Unit,
) {
    val firstName by viewModel.firstName.collectAsState()
    val lastName by viewModel.lastName.collectAsState()
    val avatarColorHex by viewModel.avatarColor.collectAsState()
    val firstNameError by viewModel.firstNameError.collectAsState()
    val firstNameErrorMessage by viewModel.firstNameErrorMessage.collectAsState()
    val lastNameError by viewModel.lastNameError.collectAsState()
    val lastNameErrorMessage by viewModel.lastNameErrorMessage.collectAsState()
    val state by viewModel.state.collectAsState()

    val avatarColor = remember(avatarColorHex) {
        Color(android.graphics.Color.parseColor(avatarColorHex))
    }

    var avatarTapped by remember { mutableStateOf(false) }
    var firstNameFocused by remember { mutableStateOf(false) }
    var lastNameFocused by remember { mutableStateOf(false) }

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
            .padding(horizontal = 24.dp)
            .graphicsLayer {
                alpha = slideAlpha
                translationY = slideOffsetY
            },
    ) {
        Spacer(Modifier.height(8.dp))
        IconButton(onClick = {}) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = White)
        }
        Spacer(Modifier.height(8.dp))

        Text("ALMOST THERE", color = Indigo, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
        Spacer(Modifier.height(12.dp))
        Text("Set up your profile", fontWeight = FontWeight.Bold, fontSize = 22.sp, color = White)
        Spacer(Modifier.height(8.dp))
        Text(
            "This is how BantAI will address you. Your name stays on your device and is never shared.",
            fontSize = 13.sp,
            color = TextSecondary,
            lineHeight = 20.sp,
        )
        Spacer(Modifier.height(32.dp))

        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .background(avatarColor, CircleShape)
                    .clickable {
                        viewModel.cycleAvatarColor()
                        avatarTapped = true
                    },
                contentAlignment = Alignment.Center,
            ) {
                Text(viewModel.getInitials(), color = White, fontSize = 28.sp, fontWeight = FontWeight.Bold)
            }
            if (!avatarTapped) {
                Text(
                    "Tap to change color",
                    color = TextSecondary,
                    fontSize = 11.sp,
                )
            }
        }

        Spacer(Modifier.height(32.dp))

        Text("First name", fontSize = 12.sp, color = TextSecondary)
        Spacer(Modifier.height(6.dp))
        OutlinedTextField(
            value = firstName,
            onValueChange = { if (it.length <= 30) viewModel.updateFirstName(it) },
            modifier = Modifier
                .fillMaxWidth()
                .onFocusChanged { firstNameFocused = it.isFocused },
            singleLine = true,
            placeholder = { Text("e.g. Maria", color = TextSecondary) },
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
            shape = RoundedCornerShape(12.dp),
            colors = nameFieldColors(),
        )
        if (firstNameError) {
            Spacer(Modifier.height(4.dp))
            Text(firstNameErrorMessage, color = Danger, fontSize = 12.sp)
        }
        if (firstNameFocused) {
            Text(
                "${firstName.length}/30",
                color = TextSecondary,
                fontSize = 11.sp,
                textAlign = TextAlign.End,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        Spacer(Modifier.height(16.dp))

        Text("Last name (optional)", fontSize = 12.sp, color = TextSecondary)
        Spacer(Modifier.height(6.dp))
        OutlinedTextField(
            value = lastName,
            onValueChange = { if (it.length <= 30) viewModel.updateLastName(it) },
            modifier = Modifier
                .fillMaxWidth()
                .onFocusChanged { lastNameFocused = it.isFocused },
            singleLine = true,
            placeholder = { Text("e.g. Santos", color = TextSecondary) },
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
            shape = RoundedCornerShape(12.dp),
            colors = nameFieldColors(),
        )
        if (lastNameError) {
            Spacer(Modifier.height(4.dp))
            Text(lastNameErrorMessage, color = Danger, fontSize = 12.sp)
        }
        if (lastNameFocused) {
            Text(
                "${lastName.length}/30",
                color = TextSecondary,
                fontSize = 11.sp,
                textAlign = TextAlign.End,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        Spacer(Modifier.weight(1f))

        if (state.errorMessage != null) {
            Text(state.errorMessage ?: "", fontSize = 12.sp, color = Danger)
            Spacer(Modifier.height(12.dp))
        }

        Button(
            onClick = { viewModel.validateAndSaveProfile(onSuccess = onNext) },
            enabled = !state.isLoading,
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Indigo),
        ) {
            Text(if (state.isLoading) "Saving..." else "Continue", color = White, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun nameFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = White,
    unfocusedTextColor = White,
    focusedBorderColor = Indigo,
    unfocusedBorderColor = BorderColor,
    focusedContainerColor = Surface,
    unfocusedContainerColor = Surface,
    cursorColor = Indigo,
)
