package com.bantai.ui.components

import android.widget.Toast
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import com.bantai.R
import com.bantai.viewmodel.SettingsViewModel

/**
 * Asks people who finished onboarding before the consent step existed the same
 * question once. Shown only when signed in, never answered on this phone, and
 * the account isn't already opted in (read from the server; offline means
 * "not now", so nobody is asked on a guess). Either answer ends it.
 */
@Composable
fun TrainingConsentPrompt(settingsViewModel: SettingsViewModel) {
    val userData by settingsViewModel.userData.collectAsState()
    val optedIn by settingsViewModel.trainingOptIn.collectAsState()
    var saving by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val signedIn = userData.authToken.isNotEmpty()

    LaunchedEffect(signedIn, userData.trainingConsentAsked) {
        if (signedIn && !userData.trainingConsentAsked) settingsViewModel.loadTrainingOptIn()
    }
    // Already opted in (e.g. on another phone): nothing to ask.
    LaunchedEffect(optedIn, userData.trainingConsentAsked) {
        if (optedIn == true && !userData.trainingConsentAsked) settingsViewModel.markTrainingConsentAsked()
    }

    val stillToAsk = signedIn && !userData.trainingConsentAsked
    // optedIn is null until the server answers: never ask on a guess.
    if (!userData.onboardingComplete || !stillToAsk || optedIn != false) return

    fun answer(enabled: Boolean) {
        saving = true
        settingsViewModel.answerTrainingConsent(
            enabled = enabled,
            onDone = { saving = false },
            onFailed = {
                saving = false
                Toast.makeText(context, R.string.training_consent_save_failed, Toast.LENGTH_LONG).show()
            },
        )
    }

    AlertDialog(
        // Dismissing without answering just asks again next time.
        onDismissRequest = {},
        title = { Text(stringResource(R.string.training_consent_title)) },
        text = {
            Text(
                stringResource(R.string.training_consent_body) + "\n\n" +
                    stringResource(R.string.training_consent_point_change),
            )
        },
        confirmButton = {
            TextButton(onClick = { answer(true) }, enabled = !saving) {
                Text(stringResource(R.string.training_consent_yes))
            }
        },
        dismissButton = {
            TextButton(onClick = { answer(false) }, enabled = !saving) {
                Text(stringResource(R.string.training_consent_no))
            }
        },
    )
}
