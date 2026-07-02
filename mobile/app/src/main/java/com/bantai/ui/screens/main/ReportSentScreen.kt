package com.bantai.ui.screens.main

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.navigation.Screen
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.White

@Composable
fun ReportSentScreen(type: String, navController: NavController) {
    val title = when (type) {
        "block_only" -> "Number blocked"
        "both" -> "Report submitted & number blocked"
        else -> "Report submitted"
    }
    val body = when (type) {
        "block_only" -> "The number has been added to your blocked list and can no longer send you messages. You can unblock it anytime from this screen."
        "both" -> "Your report has been submitted and the number has been blocked. It can no longer send you messages."
        else -> "Thank you for your report. It helps PhishNet improve its AI model and protect other users from this threat."
    }
    val buttonText = if (type == "block_only") "Got it" else "Done"

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Black)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 24.dp),
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .background(Color(0xFF0A2A0A), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Default.Check,
                    contentDescription = null,
                    tint = White,
                    modifier = Modifier.size(32.dp),
                )
            }
            Spacer(Modifier.height(24.dp))
            Text(
                title,
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = 22.sp,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(12.dp))
            Text(
                body,
                color = TextSecondary,
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
                lineHeight = 20.sp,
            )

            if (type == "report_only" || type == "both") {
                Spacer(Modifier.height(24.dp))
                Text(
                    "What happens next",
                    color = TextSecondary,
                    fontSize = 13.sp,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(12.dp))
                val checklistItems = buildList {
                    add("Report queued for admin review")
                    add("Used to retrain the PhishNet AI model")
                    add("Domain/sender flagged for campaign tracking")
                    if (type == "both") add("Number added to your blocked list")
                }
                checklistItems.forEach { item ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Icon(
                            Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = Safe,
                            modifier = Modifier.size(20.dp),
                        )
                        Text(item, color = White, fontSize = 14.sp)
                    }
                }
            }
        }

        Button(
            onClick = {
                if (type == "block_only") {
                    navController.navigate(Screen.BlockedNumbers.route)
                } else {
                    navController.popBackStack(Screen.Main.route, false)
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Indigo),
        ) {
            Text(buttonText, color = White, fontWeight = FontWeight.Medium, fontSize = 16.sp)
        }
        Spacer(Modifier.height(16.dp))
    }
}
