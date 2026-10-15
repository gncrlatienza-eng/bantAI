package com.bantai.ui.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bantai.R
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.DarkIndigo
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White

/**
 * Asks, once and as its own step, whether the team may review masked copies
 * of messages the AI flagged or was unsure about, to improve detection
 * (backend detection review queue). Consent has to be a real choice: it isn't
 * bundled with the terms, nothing is preselected, both answers are the same
 * size, and using BantAI never depends on saying yes. Changeable later in
 * Settings -> Privacy & data.
 */
@Composable
fun OnboardingTrainingConsentScreen(
    saving: Boolean,
    onAnswer: (Boolean) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black)
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = 24.dp),
    ) {
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState()),
        ) {
            Spacer(Modifier.height(40.dp))
            Box(
                modifier = Modifier.size(48.dp).background(DarkIndigo, RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.Shield, contentDescription = null, tint = Indigo, modifier = Modifier.size(28.dp))
            }
            Spacer(Modifier.height(16.dp))
            Text(
                stringResource(R.string.training_consent_title),
                fontWeight = FontWeight.Bold,
                fontSize = TextSize.Title,
                color = White,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                stringResource(R.string.training_consent_body),
                fontSize = TextSize.Footnote,
                color = TextSecondary,
                lineHeight = 20.sp,
            )
            Spacer(Modifier.height(24.dp))
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                ConsentPoint(Icons.Filled.Lock, stringResource(R.string.training_consent_point_masked))
                ConsentPoint(Icons.Filled.Person, stringResource(R.string.training_consent_point_person))
                ConsentPoint(Icons.Filled.Settings, stringResource(R.string.training_consent_point_change))
            }
            Spacer(Modifier.height(24.dp))
        }

        // Same size and style for both answers: neither is the nudged default.
        ConsentButton(stringResource(R.string.training_consent_yes), enabled = !saving) { onAnswer(true) }
        Spacer(Modifier.height(8.dp))
        ConsentButton(stringResource(R.string.training_consent_no), enabled = !saving) { onAnswer(false) }
        Spacer(Modifier.height(16.dp))
    }
}

@Composable
private fun ConsentButton(
    text: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Surface, contentColor = White),
    ) {
        Text(text, fontWeight = FontWeight.SemiBold, fontSize = TextSize.Body)
    }
}

@Composable
private fun ConsentPoint(
    icon: ImageVector,
    text: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(Surface, RoundedCornerShape(12.dp))
                .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(icon, contentDescription = null, tint = Indigo, modifier = Modifier.size(22.dp))
        Text(text, color = White, fontSize = TextSize.Subhead, modifier = Modifier.weight(1f))
    }
}
