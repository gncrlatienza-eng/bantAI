package com.bantai.ui.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.navigation.Screen
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.White
import com.bantai.viewmodel.OnboardingViewModel

private data class TermsCard(val title: String, val body: String)

private val termsCards = listOf(
    TermsCard(
        "Data collected",
        "BantAI collects anonymized SMS metadata (sender hash, message hash, timestamp) to improve its detection model. No message body is stored on our servers.",
    ),
    TermsCard(
        "How it works",
        "Messages are classified locally on your device using an on-device AI model. Only aggregate, non-identifiable statistics are used for model retraining.",
    ),
    TermsCard(
        "Your rights",
        "You can delete your account and all associated data at any time from Settings > Account. Deletion is permanent and irreversible.",
    ),
    TermsCard(
        "Third parties",
        "BantAI does not sell your data to third parties. We may share aggregate threat intelligence with authorized research partners.",
    ),
)

@Composable
fun OnboardingTermsScreen(
    navController: NavController,
    viewModel: OnboardingViewModel,
) {
    val state by viewModel.state.collectAsState()
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Black)
            .statusBarsPadding()
            .navigationBarsPadding(),
    ) {
        // Top bar
        Column(modifier = Modifier.padding(horizontal = 24.dp)) {
            Spacer(Modifier.height(8.dp))
            IconButton(onClick = { navController.popBackStack() }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = White)
            }
            Spacer(Modifier.height(8.dp))
            Text("STEP 4 OF 4", color = Indigo, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            Spacer(Modifier.height(12.dp))
            Text("Terms & Privacy", fontWeight = FontWeight.Bold, fontSize = 22.sp, color = White)
            Spacer(Modifier.height(16.dp))
        }

        // Scrollable content
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(scrollState)
                .padding(horizontal = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            termsCards.forEach { card ->
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Surface, RoundedCornerShape(12.dp))
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(card.title, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = White)
                    Text(card.body, fontSize = 13.sp, color = TextSecondary, lineHeight = 20.sp)
                }
            }
            Spacer(Modifier.height(8.dp))
        }

        // Fixed bottom
        Column(modifier = Modifier.padding(horizontal = 16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(vertical = 8.dp),
            ) {
                Checkbox(
                    checked = state.termsAccepted,
                    onCheckedChange = { viewModel.updateTermsAccepted(it) },
                    colors = CheckboxDefaults.colors(
                        checkedColor = Indigo,
                        uncheckedColor = TextSecondary,
                        checkmarkColor = White,
                    ),
                )
                Text(
                    "I have read and agree to the Terms of Service and Privacy Policy.",
                    color = White,
                    fontSize = 13.sp,
                    lineHeight = 18.sp,
                    modifier = Modifier.padding(start = 4.dp),
                )
            }
            Button(
                onClick = { navController.navigate(Screen.OnboardingProfile.route) },
                enabled = state.termsAccepted,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Indigo,
                    disabledContainerColor = Color(0xFF2A2A2A),
                    disabledContentColor = TextSecondary,
                ),
            ) {
                Text("Get started", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
            }
            Spacer(Modifier.height(16.dp))
        }
    }
}
