@file:Suppress("MaxLineLength")

package com.bantai.ui.screens.onboarding

import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.navigation.Screen
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.BorderColor
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White
import com.bantai.viewmodel.OnboardingViewModel

private data class TermsCard(
    @StringRes val title: Int,
    @StringRes val body: Int,
)

private val termsCards =
    listOf(
        TermsCard(R.string.terms_data_title, R.string.terms_data_body),
        TermsCard(R.string.terms_how_title, R.string.terms_how_body),
        TermsCard(R.string.terms_rights_title, R.string.terms_rights_body),
        TermsCard(R.string.terms_third_parties_title, R.string.terms_third_parties_body),
    )

@Composable
fun OnboardingTermsScreen(
    navController: NavController,
    viewModel: OnboardingViewModel,
) {
    val state by viewModel.state.collectAsState()
    val scrollState = rememberScrollState()

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black)
                .statusBarsPadding()
                .navigationBarsPadding(),
    ) {
        // Top bar
        Column(modifier = Modifier.padding(horizontal = 24.dp)) {
            Spacer(Modifier.height(8.dp))
            // Terms is now the first onboarding screen, so there's usually
            // nothing to go back to.
            if (navController.previousBackStackEntry != null) {
                IconButton(onClick = { navController.popBackStack() }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.action_back), tint = White)
                }
            } else {
                Spacer(Modifier.height(40.dp))
            }
            Spacer(Modifier.height(8.dp))
            Text(stringResource(R.string.onboarding_terms_step_1_of_5), color = Indigo, fontSize = TextSize.Caption, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            Spacer(Modifier.height(12.dp))
            Text(stringResource(R.string.onboarding_terms_terms_privacy), fontWeight = FontWeight.Bold, fontSize = TextSize.Title, color = White)
            Spacer(Modifier.height(16.dp))
        }

        // Scrollable content
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .verticalScroll(scrollState)
                    .padding(horizontal = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            termsCards.forEach { card ->
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(Surface, RoundedCornerShape(12.dp))
                            .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(stringResource(card.title), fontWeight = FontWeight.Bold, fontSize = TextSize.Subhead, color = White)
                    Text(stringResource(card.body), fontSize = TextSize.Footnote, color = TextSecondary, lineHeight = 20.sp)
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
                    colors =
                        CheckboxDefaults.colors(
                            checkedColor = Indigo,
                            uncheckedColor = TextSecondary,
                            checkmarkColor = White,
                        ),
                )
                Text(
                    stringResource(R.string.onboarding_terms_i_have_read_and_agree),
                    color = White,
                    fontSize = TextSize.Footnote,
                    lineHeight = 18.sp,
                    modifier = Modifier.padding(start = 4.dp),
                )
            }
            Button(
                onClick = { navController.navigate(Screen.OnboardingConfirmNumber.route) },
                enabled = state.termsAccepted,
                modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
                shape = RoundedCornerShape(12.dp),
                colors =
                    ButtonDefaults.buttonColors(
                        containerColor = Indigo,
                        disabledContainerColor = BorderColor,
                        disabledContentColor = TextSecondary,
                    ),
            ) {
                Text(stringResource(R.string.onboarding_terms_get_started), fontWeight = FontWeight.SemiBold, fontSize = TextSize.Body)
            }
            Spacer(Modifier.height(16.dp))
        }
    }
}
