package com.bantai.ui.screens.onboarding

import android.Manifest
import android.content.pm.PackageManager
import android.telephony.TelephonyManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
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

/**
 * Normalizes whatever format TelephonyManager hands back (e.g. "09171234567",
 * "639171234567", "+639171234567") into a display-friendly PH number.
 * Returns null when the value isn't a recognizable PH mobile number — carriers
 * frequently leave this blank or return garbage, so callers must be ready to
 * fall back to manual entry.
 */
private fun normalizePhNumber(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    val digits = raw.filter { it.isDigit() }
    val tenDigit =
        when {
            digits.length == 10 && digits.startsWith("9") -> digits
            digits.length == 11 && digits.startsWith("09") -> digits.substring(1)
            digits.length == 12 && digits.startsWith("639") -> digits.substring(2)
            digits.length == 13 && digits.startsWith("0063") -> digits.substring(3)
            else -> null
        } ?: return null
    return "+63 ${tenDigit.substring(0, 3)} ${tenDigit.substring(3, 6)} ${tenDigit.substring(6)}"
}

@Composable
fun OnboardingConfirmNumberScreen(
    navController: NavController,
    viewModel: OnboardingViewModel,
) {
    val context = LocalContext.current
    var phoneNumber by remember { mutableStateOf("") }
    var autoDetected by remember { mutableStateOf(false) }
    val state by viewModel.state.collectAsState()

    fun readSimNumber() {
        val telephonyManager = context.getSystemService(TelephonyManager::class.java) ?: return
        val hasPermission =
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.READ_PHONE_NUMBERS,
            ) == PackageManager.PERMISSION_GRANTED
        if (!hasPermission) return
        val detected =
            try {
                normalizePhNumber(telephonyManager.line1Number)
            } catch (_: SecurityException) {
                null
            }
        if (detected != null) {
            phoneNumber = detected
            autoDetected = true
        }
    }

    val permissionLauncher =
        rememberLauncherForActivityResult(
            ActivityResultContracts.RequestPermission(),
        ) { readSimNumber() }

    LaunchedEffect(Unit) {
        val alreadyGranted =
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.READ_PHONE_NUMBERS,
            ) == PackageManager.PERMISSION_GRANTED
        if (alreadyGranted) {
            readSimNumber()
        } else {
            permissionLauncher.launch(Manifest.permission.READ_PHONE_NUMBERS)
        }
    }

    Column(
        modifier =
            Modifier
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
            subtitle =
                if (autoDetected) {
                    "We detected this number from your SIM. Confirm it's correct or enter your number manually."
                } else {
                    "Enter your Philippine mobile number (+63...)."
                },
        )
        Spacer(Modifier.height(32.dp))

        SectionLabel("Phone number")
        Spacer(Modifier.height(8.dp))
        PillTextField(
            value = phoneNumber,
            onValueChange = {
                phoneNumber = it
                autoDetected = false
            },
            placeholder = "+63 917 123 4567",
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
            enabled = !state.isLoading && phoneNumber.isNotBlank(),
            isLoading = state.isLoading,
        )
        Spacer(Modifier.height(24.dp))
    }
}
