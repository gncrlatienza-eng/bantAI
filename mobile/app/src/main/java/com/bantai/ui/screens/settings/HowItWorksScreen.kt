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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.ui.components.LocalBottomBarClearance
import com.bantai.ui.theme.*

// (title, body) string resource ids, resolved where they're shown.
private val howItWorksSections =
    listOf(
        R.string.how_step1_title to R.string.how_step1_body,
        R.string.how_step2_title to R.string.how_step2_body,
        R.string.how_step3_title to R.string.how_step3_body,
        R.string.how_step4_title to R.string.how_step4_body,
        R.string.how_step5_title to R.string.how_step5_body,
        R.string.how_privacy_title to R.string.how_privacy_body,
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
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.action_back), tint = White)
            }
            Text(
                stringResource(R.string.how_it_works_how_bantai_works),
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = TextSize.Headline,
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

            sections.forEach { (titleRes, bodyRes) ->
                val title = stringResource(titleRes)
                val body = stringResource(bodyRes)
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(Surface, RoundedCornerShape(12.dp))
                            .padding(16.dp),
                ) {
                    Text(title, color = Indigo, fontWeight = FontWeight.Bold, fontSize = TextSize.Subhead)
                    Spacer(Modifier.height(6.dp))
                    Text(body, color = TextSecondary, fontSize = TextSize.Footnote, lineHeight = 20.sp)
                }
                Spacer(Modifier.height(10.dp))
            }

            // Bottom clearance matches the floating tab bar's footprint (see
            // MainScreen) -- this screen now renders behind that persistent bar.
            Spacer(Modifier.height(LocalBottomBarClearance.current))
        }
    }
}
