package com.bantai.ui.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.navigation.Screen
import com.bantai.ui.components.OnboardingHeader
import com.bantai.ui.components.PillTextField
import com.bantai.ui.components.PrimaryButton
import com.bantai.ui.components.SectionLabel
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.viewmodel.OnboardingViewModel

@Suppress("LongMethod") // one screen, sign-in and sign-up wording
@Composable
fun OnboardingConfirmNumberScreen(
    navController: NavController,
    viewModel: OnboardingViewModel,
    signIn: Boolean = false,
    onCreateAccount: (() -> Unit)? = null,
) {
    var phoneNumber by remember { mutableStateOf("") }
    val state by viewModel.state.collectAsState()

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black)
                .statusBarsPadding()
                .navigationBarsPadding()
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp),
    ) {
        Spacer(Modifier.height(40.dp))

        // Signing in isn't a setup step, so no "Step 2 of 5".
        OnboardingHeader(
            eyebrow = if (signIn) null else stringResource(R.string.onboarding_confirm_number_step_2_of_5),
            title =
                stringResource(
                    if (signIn) R.string.sign_in_title else R.string.onboarding_confirm_number_enter_your_phone,
                ),
            subtitle =
                stringResource(
                    if (signIn) R.string.sign_in_subtitle else R.string.onboarding_confirm_number_we_ll_text_you_a,
                ),
        )
        Spacer(Modifier.height(32.dp))

        SectionLabel(stringResource(R.string.onboarding_confirm_number_phone_number))
        Spacer(Modifier.height(8.dp))
        PillTextField(
            value = phoneNumber,
            onValueChange = { phoneNumber = it },
            placeholder = stringResource(R.string.onboarding_confirm_number_phone_example),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
        )
        Spacer(Modifier.height(8.dp))
        Text(
            stringResource(R.string.onboarding_confirm_number_sms_notice),
            fontSize = TextSize.Caption,
            color = TextSecondary,
        )

        if (state.errorMessage != null) {
            Spacer(Modifier.height(12.dp))
            Text(state.errorMessage ?: "", fontSize = TextSize.Caption, color = Danger)
        }

        Spacer(Modifier.weight(1f))

        PrimaryButton(
            text = stringResource(R.string.onboarding_confirm_number_send_verification_code),
            onClick = {
                viewModel.requestVerificationCode(phoneNumber) {
                    navController.navigate(Screen.OnboardingEnterCode.route)
                }
            },
            enabled = !state.isLoading && phoneNumber.isNotBlank(),
            isLoading = state.isLoading,
        )
        if (onCreateAccount != null) {
            TextButton(onClick = onCreateAccount, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.sign_in_create_account), color = Indigo, fontSize = TextSize.Subhead)
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}
