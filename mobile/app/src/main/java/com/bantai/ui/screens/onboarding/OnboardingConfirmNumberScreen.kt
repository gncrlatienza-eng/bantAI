package com.bantai.ui.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
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
            .padding(horizontal = 24.dp),
    ) {
        Spacer(Modifier.height(40.dp))

        Text(
            "STEP 2 OF 4",
            color = Indigo,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp,
        )
        Spacer(Modifier.height(12.dp))
        Text("Confirm your number", fontWeight = FontWeight.Bold, fontSize = 22.sp, color = White)
        Spacer(Modifier.height(8.dp))
        Text(
            "We detected this number from your SIM. Confirm it's correct or enter your number manually.",
            fontSize = 13.sp,
            color = TextSecondary,
            lineHeight = 20.sp,
        )
        Spacer(Modifier.height(32.dp))

        Text("Phone number", fontSize = 12.sp, color = TextSecondary)
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = phoneNumber,
            onValueChange = { phoneNumber = it },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = White,
                unfocusedTextColor = White,
                focusedBorderColor = Indigo,
                unfocusedBorderColor = BorderColor,
                focusedContainerColor = Surface,
                unfocusedContainerColor = Surface,
                cursorColor = Indigo,
            ),
        )
        Spacer(Modifier.height(8.dp))
        Text("Philippine mobile number (+63...)", fontSize = 11.sp, color = TextSecondary)

        if (state.errorMessage != null) {
            Spacer(Modifier.height(12.dp))
            Text(state.errorMessage ?: "", fontSize = 12.sp, color = Color(0xFFFF5252))
        }

        Spacer(Modifier.weight(1f))

        Button(
            onClick = {
                viewModel.requestOtp(phoneNumber) {
                    navController.navigate(Screen.OnboardingEnterCode.route)
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
                Text("Send verification code", color = White, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}
