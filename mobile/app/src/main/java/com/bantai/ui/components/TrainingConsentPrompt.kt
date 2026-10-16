package com.bantai.ui.components

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bantai.R
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White
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

    // Read on every sign-in, not only while unanswered: the choice also turns
    // reports on or off on this phone, so a change made on another phone has
    // to reach it.
    LaunchedEffect(signedIn) {
        if (signedIn) settingsViewModel.loadTrainingOptIn()
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

    BantaiAlertDialog(
        // Dismissing without answering just asks again next time.
        onDismissRequest = {},
        stackButtons = true,
        icon = {
            Box(
                modifier = Modifier.size(52.dp).background(Indigo.copy(alpha = 0.15f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Filled.VerifiedUser,
                    contentDescription = null,
                    tint = Indigo,
                    modifier = Modifier.size(26.dp),
                )
            }
        },
        title = { Text(stringResource(R.string.training_consent_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(stringResource(R.string.training_consent_lead))
                ConsentPoint(stringResource(R.string.training_consent_point_masked))
                ConsentPoint(stringResource(R.string.training_consent_point_person))
                ConsentPoint(stringResource(R.string.training_consent_point_off))
            }
        },
        confirmButton = {
            TextButton(onClick = { answer(true) }, enabled = !saving) {
                // Same look as "Not now": neither answer is the nudged default.
                Text(stringResource(R.string.training_consent_yes), color = Indigo, fontSize = TextSize.Body)
            }
        },
        dismissButton = {
            TextButton(onClick = { answer(false) }, enabled = !saving) {
                Text(stringResource(R.string.training_consent_no), color = Indigo, fontSize = TextSize.Body)
            }
        },
    )
}

// One reassurance line: a check, then the point, left-aligned so it scans.
@Composable
private fun ConsentPoint(text: String) {
    Row(verticalAlignment = Alignment.Top) {
        Icon(
            Icons.Filled.CheckCircle,
            contentDescription = null,
            tint = Safe,
            modifier = Modifier.padding(top = 1.dp).size(16.dp),
        )
        Spacer(Modifier.width(8.dp))
        Text(text, color = White, fontSize = TextSize.Footnote, lineHeight = 18.sp, textAlign = TextAlign.Start)
    }
}
