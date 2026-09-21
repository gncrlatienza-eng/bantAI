@file:Suppress("MaxLineLength")

package com.bantai.ui.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.ui.theme.*

private val howItWorksSections =
    listOf(
        "Step 1 — Receive SMS" to "When a message arrives, BantAI intercepts it as the default SMS app before it reaches your inbox.",
        "Step 2 — Local classification" to
            "Your device uses privacy-preserving heuristic threat checks. The result drives local alerts even when the network is unavailable.",
        "Step 3 — Explanations" to
            "Detailed server-side SHAP explanations are unavailable in privacy-first mode because message content stays on your device.",
        "Step 4 — Cluster" to
            "HDBSCAN groups similar smishing messages into campaigns, helping detect coordinated attacks across multiple senders.",
        "Step 5 — Alert" to
            "High-confidence smishing triggers a push notification and clear choices to block, report, or ignore. Suspicious messages are flagged for your review.",
        "Your Privacy" to
            "SMS content stays on your device. After sign-in, BantAI briefly sends the sender to derive a server-side pseudonym, then syncs that pseudonym, classification outcome, timestamp, and campaign domains for threat intelligence.",
    )

@Composable
fun HowItWorksScreen(navController: NavController) {
    val sections = howItWorksSections

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 4.dp, vertical = 4.dp),
        ) {
            IconButton(
                onClick = { navController.popBackStack() },
                modifier = Modifier.align(Alignment.CenterStart),
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = White)
            }
            Text(
                "How BantAI Works",
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp,
                modifier = Modifier.align(Alignment.Center),
            )
        }
        HorizontalDivider(color = Surface)

        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp),
        ) {
            Spacer(Modifier.height(16.dp))

            sections.forEach { (title, body) ->
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(Surface, RoundedCornerShape(12.dp))
                            .padding(16.dp),
                ) {
                    Text(title, color = Indigo, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Spacer(Modifier.height(6.dp))
                    Text(body, color = TextSecondary, fontSize = 13.sp, lineHeight = 20.sp)
                }
                Spacer(Modifier.height(10.dp))
            }

            // Bottom clearance matches the floating tab bar's footprint (see
            // MainScreen) -- this screen now renders behind that persistent bar.
            Spacer(Modifier.height(116.dp))
        }
    }
}
