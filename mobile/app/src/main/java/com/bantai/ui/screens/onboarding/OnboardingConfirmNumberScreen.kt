package com.bantai.ui.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.navigation.Screen
import com.bantai.ui.components.OnboardingHeader
import com.bantai.ui.components.PillTextField
import com.bantai.ui.components.PrimaryButton
import com.bantai.ui.components.SectionLabel
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.TextSecondary
import com.bantai.viewmodel.OnboardingViewModel

@Composable
fun OnboardingConfirmNumberScreen(
    navController: NavController,
    viewModel: OnboardingViewModel,
) {
    var phoneNumber by remember { mutableStateOf("+63 917 123 4567") }
    val state by viewModel.state.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Black)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 20.dp),
    ) {
        Spacer(Modifier.height(40.dp))

        OnboardingHeader(
            eyebrow = "Step 2 of 4",
            title = "Confirm your number",
            subtitle = "We detected this number from your SIM. Confirm it's correct or enter your number manually.",
        )
        Spacer(Modifier.height(32.dp))

        SectionLabel("Phone number")
        Spacer(Modifier.height(8.dp))
        PillTextField(
            value = phoneNumber,
            onValueChange = { phoneNumber = it },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
        )
        Spacer(Modifier.height(8.dp))
        Text("Philippine mobile number (+63...)", fontSize = 12.sp, color = TextSecondary)

        if (state.errorMessage != null) {
            Spacer(Modifier.height(12.dp))
            Text(state.errorMessage ?: "", fontSize = 12.sp, color = Danger)
        }

        Spacer(Modifier.weight(1f))

        PrimaryButton(
            text = "Send verification code",
            onClick = {
                viewModel.requestOtp(phoneNumber) {
                    navController.navigate(Screen.OnboardingEnterCode.route)
                }
            },
            enabled = !state.isLoading,
            isLoading = state.isLoading,
        )
        Spacer(Modifier.height(24.dp))
    }
}
