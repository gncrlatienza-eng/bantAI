package com.bantai.ui.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.White

private fun tipTitle(tip: String) = when (tip) {
    "gcash"   -> "How to spot a GCash scam"
    "urgency" -> "Why scammers use urgency"
    "links"   -> "Safe links vs phishing links"
    "otp"     -> "OTP scams explained"
    "action"  -> "What to do when scammed"
    "shap"    -> "Understanding SHAP scores"
    else      -> "Scam Awareness Tip"
}

@Composable
fun TipDetailScreen(tip: String, navController: NavController) {
    val title = tipTitle(tip)

    Column(modifier = Modifier.fillMaxSize().background(Black)) {
        Box(
            modifier = Modifier
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
                "Tip",
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp,
                modifier = Modifier.align(Alignment.Center),
            )
        }
        HorizontalDivider(color = Surface)

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 24.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                Text(title, color = White, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                Spacer(Modifier.height(4.dp))
                Text("BantAI Education · 3 min read", color = TextSecondary, fontSize = 12.sp)
            }

            // Quote card
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF16163A), RoundedCornerShape(12.dp))
                        .padding(16.dp),
                    verticalAlignment = Alignment.Top,
                ) {
                    Icon(
                        Icons.Filled.Shield,
                        contentDescription = null,
                        tint = Indigo,
                        modifier = Modifier.size(16.dp),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "Learning how scams work is your first line of defense.",
                        color = Indigo,
                        fontSize = 13.sp,
                        fontStyle = FontStyle.Italic,
                    )
                }
            }

            item {
                SectionHeading("What is it?")
                Spacer(Modifier.height(8.dp))
                Text(
                    "Smishing (SMS phishing) is a type of fraud where attackers send text messages pretending to be trusted brands like GCash, BDO, or government agencies to steal your credentials or money.",
                    color = TextSecondary,
                    fontSize = 14.sp,
                    lineHeight = 22.sp,
                )
            }

            item {
                SectionHeading("Red flags to watch for")
                Spacer(Modifier.height(8.dp))
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    BulletPoint("Unexpected urgency (\"Act now or your account will be suspended\")")
                    BulletPoint("Links to unfamiliar domains")
                    BulletPoint("Requests for OTP or personal information")
                    BulletPoint("Poor grammar or inconsistent branding")
                }
            }

            item {
                SectionHeading("What to do")
                Spacer(Modifier.height(8.dp))
                Text(
                    "Do not click the link. Do not reply. Block the sender. Report it through BantAI using the Report button in the message thread. If you already clicked: change your password immediately and contact your bank.",
                    color = TextSecondary,
                    fontSize = 14.sp,
                    lineHeight = 22.sp,
                )
            }
        }
    }
}

@Composable
private fun SectionHeading(text: String) {
    Text(text, color = White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
}

@Composable
private fun BulletPoint(text: String) {
    Row(verticalAlignment = Alignment.Top) {
        Text("·  ", color = TextSecondary, fontSize = 14.sp)
        Text(text, color = TextSecondary, fontSize = 14.sp, lineHeight = 22.sp)
    }
}
