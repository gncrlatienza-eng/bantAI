package com.bantai.ui.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.ui.graphics.Color
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.navigation.Screen
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.BorderColor
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.White
import com.bantai.viewmodel.OnboardingViewModel

@Composable
fun OnboardingEnterCodeScreen(
    navController: NavController,
    viewModel: OnboardingViewModel,
) {
    val state by viewModel.state.collectAsState()
    val digits = remember { mutableStateListOf("", "", "", "", "", "") }
    val focusRequesters = remember { List(6) { FocusRequester() } }

    LaunchedEffect(Unit) { focusRequesters[0].requestFocus() }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Black)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 24.dp),
    ) {
        Spacer(Modifier.height(16.dp))
        IconButton(onClick = { navController.popBackStack() }) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = White)
        }
        Spacer(Modifier.height(16.dp))

        Text("STEP 3 OF 4", color = Indigo, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
        Spacer(Modifier.height(12.dp))
        Text("Enter the code", fontWeight = FontWeight.Bold, fontSize = 22.sp, color = White)
        Spacer(Modifier.height(8.dp))
        Text(
            "We sent a 6-digit verification code to ${state.phoneNumber}.",
            fontSize = 13.sp,
            color = TextSecondary,
            lineHeight = 20.sp,
        )
        Spacer(Modifier.height(32.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            repeat(6) { i ->
                OtpBox(
                    value = digits[i],
                    focusRequester = focusRequesters[i],
                    onValueChange = { new ->
                        val filtered = new.filter { it.isDigit() }
                        when {
                            filtered.isEmpty() -> {
                                digits[i] = ""
                                if (i > 0) focusRequesters[i - 1].requestFocus()
                            }
                            else -> {
                                digits[i] = filtered.last().toString()
                                if (i < 5) focusRequesters[i + 1].requestFocus()
                            }
                        }
                        viewModel.updateOtpCode(digits.joinToString(""))
                    },
                    modifier = Modifier.weight(1f),
                )
            }
        }

        if (state.errorMessage != null) {
            Spacer(Modifier.height(16.dp))
            Text(state.errorMessage ?: "", fontSize = 12.sp, color = Color(0xFFFF5252))
        }

        Spacer(Modifier.height(24.dp))
        Row {
            Text("Didn't get it? ", color = TextSecondary, fontSize = 14.sp)
            Text(
                "Resend code",
                color = Indigo,
                fontSize = 14.sp,
                modifier = Modifier.clickable { viewModel.resendOtp() },
            )
        }

        Spacer(Modifier.weight(1f))

        Button(
            onClick = {
                viewModel.verifyOtp {
                    navController.navigate(Screen.OnboardingProfile.route)
                }
            },
            enabled = !state.isLoading,
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Indigo),
        ) {
            if (state.isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.height(20.dp),
                    color = White,
                    strokeWidth = 2.dp,
                )
            } else {
                Text("Verify", color = White, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun OtpBox(
    value: String,
    focusRequester: FocusRequester,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()

    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier
            .size(48.dp)
            .focusRequester(focusRequester),
        textStyle = TextStyle(
            color = White,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
        ),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        singleLine = true,
        interactionSource = interactionSource,
        decorationBox = { innerTextField ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Surface, RoundedCornerShape(8.dp))
                    .border(
                        width = if (isFocused) 1.5.dp else 1.dp,
                        color = if (isFocused) Indigo else BorderColor,
                        shape = RoundedCornerShape(8.dp),
                    ),
                contentAlignment = Alignment.Center,
            ) { innerTextField() }
        },
    )
}
