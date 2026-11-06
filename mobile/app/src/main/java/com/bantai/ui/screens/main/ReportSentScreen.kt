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
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.navigation.Screen
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.OnIndigo
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White

@Composable
@Suppress("LongMethod", "MaxLineLength")
fun ReportSentScreen(
    type: String,
    navController: NavController,
) {
    val title =
        stringResource(
            when (type) {
                "block_only" -> R.string.report_sent_title_blocked
                "both" -> R.string.report_sent_title_both
                else -> R.string.report_sent_title_reported
            },
        )
    val body =
        stringResource(
            when (type) {
                "block_only" -> R.string.report_sent_body_blocked
                "both" -> R.string.report_sent_body_both
                else -> R.string.report_sent_body_reported
            },
        )
    val buttonText = stringResource(if (type == "block_only") R.string.report_sent_got_it else R.string.action_done)

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
                    .fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(64.dp)
                        .background(Safe.copy(alpha = 0.15f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Default.Check,
                    contentDescription = null,
                    tint = Safe,
                    modifier = Modifier.size(32.dp),
                )
            }
            Spacer(Modifier.height(24.dp))
            Text(
                title,
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = TextSize.Title,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(12.dp))
            Text(
                body,
                color = TextSecondary,
                fontSize = TextSize.Footnote,
                textAlign = TextAlign.Center,
                lineHeight = 20.sp,
            )

            if (type == "report_only" || type == "both") {
                Spacer(Modifier.height(24.dp))
                Text(
                    stringResource(R.string.report_sent_what_happens_next),
                    color = TextSecondary,
                    fontSize = TextSize.Footnote,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(12.dp))
                val checklistItems =
                    buildList {
                        add(stringResource(R.string.report_sent_step_queued))
                        add(stringResource(R.string.report_sent_step_kept))
                        add(stringResource(R.string.report_sent_step_tracked))
                        if (type == "both") add(stringResource(R.string.report_sent_step_blocked))
                    }
                checklistItems.forEach { item ->
                    Row(
                        modifier =
                            Modifier
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
                        Text(item, color = White, fontSize = TextSize.Subhead)
                    }
                }
            }
        }

        Button(
            onClick = { navController.popBackStack(Screen.Main.route, false) },
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 52.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Indigo),
        ) {
            Text(buttonText, color = OnIndigo, fontWeight = FontWeight.Medium, fontSize = TextSize.Body)
        }
        Spacer(Modifier.height(16.dp))
    }
}
