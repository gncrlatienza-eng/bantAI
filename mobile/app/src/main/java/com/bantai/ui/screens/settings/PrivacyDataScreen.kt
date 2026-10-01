package com.bantai.ui.screens.settings

import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.Download
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.data.DataExport
import com.bantai.ui.components.LocalBottomBarClearance
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White
import kotlinx.coroutines.launch

@Composable
@Suppress("LongMethod", "MaxLineLength")
fun PrivacyDataScreen(navController: NavController) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var exporting by remember { mutableStateOf(false) }
    // System "Save as" screen; the user picks where the JSON file goes.
    val exportLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
            if (uri == null) return@rememberLauncherForActivityResult
            exporting = true
            scope.launch {
                val result = DataExport.writeTo(context, uri)
                exporting = false
                Toast
                    .makeText(
                        context,
                        if (result.isSuccess) R.string.privacy_export_done else R.string.privacy_export_failed,
                        Toast.LENGTH_LONG,
                    ).show()
            }
        }

    Column(modifier = Modifier.fillMaxSize().background(Black)) {
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
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.action_back), tint = White)
            }
            Text(
                stringResource(R.string.privacy_data_privacy_data),
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = TextSize.Headline,
                modifier = Modifier.align(Alignment.Center),
            )
        }
        HorizontalDivider(color = Surface)

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            // Bottom clearance matches the floating tab bar's footprint (see
            // MainScreen) -- this screen now renders behind that persistent bar.
            contentPadding = PaddingValues(start = 16.dp, top = 16.dp, end = 16.dp, bottom = LocalBottomBarClearance.current),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            item {
                InfoCard(
                    title = stringResource(R.string.privacy_data_data_we_collect),
                    body = stringResource(R.string.privacy_data_a_server_side_pseudonymous_sender),
                )
            }
            item {
                InfoCard(
                    title = stringResource(R.string.privacy_data_how_your_data_is_used),
                    body = stringResource(R.string.privacy_data_data_supports_privacy_minimized_campaign),
                )
            }
            item {
                InfoCard(
                    title = stringResource(R.string.privacy_data_retention),
                    body = stringResource(R.string.privacy_data_pseudonymous_threat_telemetry_is_deleted),
                )
            }
            item {
                InfoCard(
                    title = stringResource(R.string.privacy_data_your_rights),
                    body = stringResource(R.string.privacy_data_you_can_request_deletion_of),
                )
            }
            item {
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(Surface, RoundedCornerShape(16.dp))
                            .clickable(enabled = !exporting) {
                                runCatching { exportLauncher.launch(DataExport.suggestedFileName()) }
                                    .onFailure {
                                        Toast.makeText(context, R.string.privacy_export_failed, Toast.LENGTH_LONG).show()
                                    }
                            }.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Filled.Download, contentDescription = null, tint = Indigo, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(12.dp))
                    Text(
                        stringResource(
                            if (exporting) R.string.privacy_export_preparing else R.string.privacy_data_download_my_data,
                        ),
                        color = Indigo,
                        fontWeight = FontWeight.Bold,
                        fontSize = TextSize.Subhead,
                        modifier = Modifier.weight(1f),
                    )
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowForwardIos,
                        contentDescription = null,
                        tint = Indigo,
                        modifier = Modifier.size(14.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun InfoCard(
    title: String,
    body: String,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(Surface, RoundedCornerShape(16.dp))
                .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(title, color = White, fontWeight = FontWeight.Bold, fontSize = TextSize.Body)
        Text(body, color = TextSecondary, fontSize = TextSize.Footnote, lineHeight = 20.sp)
    }
}
