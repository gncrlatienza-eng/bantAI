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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.GppBad
import androidx.compose.material.icons.filled.Link
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.OnIndigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White

@Composable
fun UnsafeLinkScreen(navController: NavController) {
    var showDialog by remember { mutableStateOf(false) }

    if (showDialog) {
        AlertDialog(
            onDismissRequest = { showDialog = false },
            containerColor = Surface,
            title = {
                Text(
                    stringResource(R.string.unsafe_link_proceed_at_your_own_risk),
                    color = White,
                    fontWeight = FontWeight.Bold,
                )
            },
            text = {
                Text(
                    stringResource(R.string.unsafe_link_visiting_this_link_may_expose),
                    color = TextSecondary,
                )
            },
            confirmButton = {
                TextButton(onClick = { showDialog = false }) {
                    Text(stringResource(R.string.action_ok), color = Indigo)
                }
            },
        )
    }

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
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.action_back),
                    tint = White,
                )
            }
            Text(
                stringResource(R.string.unsafe_link_unsafe_link),
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = TextSize.Headline,
                modifier = Modifier.align(Alignment.Center),
            )
        }

        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp)
                    .padding(top = 24.dp),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(80.dp)
                        .background(Danger.copy(alpha = 0.15f), RoundedCornerShape(16.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Default.GppBad, contentDescription = null, tint = Danger, modifier = Modifier.size(40.dp))
            }

            Spacer(Modifier.height(16.dp))
            Text(
                stringResource(R.string.unsafe_link_dangerous_link_detected),
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = TextSize.Title,
            )
            Spacer(Modifier.height(12.dp))
            Text(
                stringResource(R.string.unsafe_link_this_link_has_been_flagged),
                color = TextSecondary,
                fontSize = TextSize.Subhead,
                lineHeight = 20.sp,
            )
            Spacer(Modifier.height(20.dp))

            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .background(Danger.copy(alpha = 0.15f), RoundedCornerShape(12.dp))
                        .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Icon(Icons.Default.Link, contentDescription = null, tint = Danger, modifier = Modifier.size(18.dp))
                Text(
                    stringResource(R.string.unsafe_link_bdo_secure_ph_net_transactions),
                    color = Danger,
                    fontSize = TextSize.Footnote,
                    textDecoration = TextDecoration.LineThrough,
                )
            }

            Spacer(Modifier.height(24.dp))

            listOf(
                stringResource(R.string.unsafe_link_reason_unverified),
                stringResource(R.string.unsafe_link_reason_new),
                stringResource(R.string.unsafe_link_reason_reported),
                stringResource(R.string.unsafe_link_reason_campaign),
            ).forEach { item ->
                Row(
                    modifier = Modifier.padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Icon(Icons.Default.Close, contentDescription = null, tint = Danger, modifier = Modifier.size(20.dp))
                    Text(item, color = White, fontSize = TextSize.Subhead)
                }
            }
        }

        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .padding(horizontal = 24.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Button(
                onClick = { navController.popBackStack() },
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 52.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Indigo),
            ) {
                Text(
                    stringResource(R.string.unsafe_link_go_back_to_safety),
                    color = OnIndigo,
                    fontSize = TextSize.Body,
                    fontWeight = FontWeight.Medium,
                )
            }
            TextButton(onClick = { showDialog = true }) {
                Text(
                    stringResource(R.string.unsafe_link_i_understand_the_risk_proceed),
                    color = TextSecondary,
                    fontSize = TextSize.Caption,
                    textDecoration = TextDecoration.Underline,
                )
            }
        }
    }
}
