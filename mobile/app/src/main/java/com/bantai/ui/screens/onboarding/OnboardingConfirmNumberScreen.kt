package com.bantai.ui.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
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
import androidx.navigation.NavController
import com.bantai.navigation.Screen
import com.bantai.ui.components.OnboardingHeader
import com.bantai.ui.components.PillTextField
import com.bantai.ui.components.PrimaryButton
import com.bantai.ui.components.SectionLabel
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.viewmodel.OnboardingViewModel

@Composable
fun OnboardingConfirmNumberScreen(
    navController: NavController,
    viewModel: OnboardingViewModel,
) {
    var emailAddress by remember { mutableStateOf("") }
    val state by viewModel.state.collectAsState()

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black)
                .statusBarsPadding()
                .navigationBarsPadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp),
    ) {
        Spacer(Modifier.height(40.dp))

        OnboardingHeader(
            eyebrow = "Step 2 of 4",
            title = "Enter your email",
            subtitle = "We'll send your temporary mobile sign-in code through Gmail while SMS approval is pending.",
        )
        Spacer(Modifier.height(32.dp))

        SectionLabel("Email address")
        Spacer(Modifier.height(8.dp))
        PillTextField(
            value = emailAddress,
            onValueChange = { emailAddress = it },
            placeholder = "you@gmail.com",
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
        )
        Spacer(Modifier.height(8.dp))
        Text("Use an inbox you can open now.", fontSize = TextSize.Caption, color = TextSecondary)

        if (state.errorMessage != null) {
            Spacer(Modifier.height(12.dp))
            Text(state.errorMessage ?: "", fontSize = TextSize.Caption, color = Danger)
        }

        Spacer(Modifier.weight(1f))

        PrimaryButton(
            text = "Send verification code",
            onClick = {
                viewModel.requestVerificationCode(emailAddress) {
                    navController.navigate(Screen.OnboardingEnterCode.route)
                }
            },
            enabled = !state.isLoading && emailAddress.isNotBlank(),
            isLoading = state.isLoading,
        )
        Spacer(Modifier.height(24.dp))
    }
}
