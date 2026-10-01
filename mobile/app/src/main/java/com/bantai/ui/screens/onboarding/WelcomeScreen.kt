package com.bantai.ui.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.bantai.R
import com.bantai.ui.components.BantAILogo
import com.bantai.ui.components.PrimaryButton
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White

/**
 * The landing page whenever nobody is signed in: first launch, after signing
 * out, or when the session expired. Create an account (the full setup) or
 * sign in to an existing one (email + code, then only the phone permissions
 * this phone still needs).
 */
@Composable
fun WelcomeScreen(
    onCreateAccount: () -> Unit,
    onSignIn: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black)
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.weight(1f))
        BantAILogo(size = 96.dp)
        Spacer(Modifier.height(24.dp))
        Text(
            stringResource(R.string.welcome_title),
            color = White,
            fontSize = TextSize.Title,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            stringResource(R.string.welcome_subtitle),
            color = TextSecondary,
            fontSize = TextSize.Subhead,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.weight(1f))
        Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            PrimaryButton(text = stringResource(R.string.welcome_create_account), onClick = onCreateAccount)
            TextButton(onClick = onSignIn, modifier = Modifier.fillMaxWidth()) {
                Text(
                    stringResource(R.string.welcome_sign_in),
                    color = Indigo,
                    fontSize = TextSize.Subhead,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}
