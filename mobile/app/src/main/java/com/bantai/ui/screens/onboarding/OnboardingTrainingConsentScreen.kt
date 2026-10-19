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
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bantai.R
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.OnIndigo
import com.bantai.ui.theme.SurfaceElevated
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
            Spacer(Modifier.height(48.dp))
            Box(
                modifier =
                    Modifier
                        .align(Alignment.CenterHorizontally)
                        .size(64.dp)
                        .background(Indigo, RoundedCornerShape(16.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.Shield, contentDescription = null, tint = OnIndigo, modifier = Modifier.size(34.dp))
            }
            Spacer(Modifier.height(20.dp))
            Text(
                stringResource(R.string.training_consent_title),
                fontWeight = FontWeight.Bold,
                fontSize = TextSize.Title,
                color = White,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
            Text(
                stringResource(R.string.training_consent_lead),
                fontSize = TextSize.Subhead,
                color = TextSecondary,
                lineHeight = 20.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(28.dp))
            ConsentPoints()
            Spacer(Modifier.height(24.dp))
        }

        // Same size and style for both answers: neither is the nudged default.
        ConsentButton(stringResource(R.string.training_consent_yes), enabled = !saving) { onAnswer(true) }
        Spacer(Modifier.height(8.dp))
        ConsentButton(stringResource(R.string.training_consent_no), enabled = !saving) { onAnswer(false) }
        Spacer(Modifier.height(16.dp))
    }
}

// One grouped card, like iOS Settings, instead of a stack of boxes.
@Composable
private fun ConsentPoints() {
    Column(Modifier.fillMaxWidth().background(SurfaceElevated, RoundedCornerShape(16.dp))) {
        ConsentPoint(Icons.Filled.Lock, stringResource(R.string.training_consent_point_masked))
        HorizontalDivider(color = Hairline, thickness = 0.5.dp, modifier = Modifier.padding(start = 52.dp))
        ConsentPoint(Icons.Filled.Person, stringResource(R.string.training_consent_point_person))
        HorizontalDivider(color = Hairline, thickness = 0.5.dp, modifier = Modifier.padding(start = 52.dp))
        ConsentPoint(Icons.Filled.Settings, stringResource(R.string.training_consent_point_off))
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
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(containerColor = SurfaceElevated, contentColor = Indigo),
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
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Icon(icon, contentDescription = null, tint = Indigo, modifier = Modifier.size(22.dp))
        Text(text, color = White, fontSize = TextSize.Footnote, lineHeight = 18.sp, modifier = Modifier.weight(1f))
    }
}
