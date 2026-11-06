@file:Suppress("MaxLineLength")

package com.bantai.ui.screens.settings

import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Sms
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.ui.components.GroupedRow
import com.bantai.ui.components.GroupedRowDivider
import com.bantai.ui.components.GroupedSectionHeader
import com.bantai.ui.components.IosTopBar
import com.bantai.ui.components.LocalBottomBarClearance
import com.bantai.ui.components.groupedItem
import com.bantai.ui.theme.*

// (title, body) string resource ids, resolved where they're shown.
// Same grouped pattern as Privacy & data: a step and one line at a glance,
// the full explanation one tap away.
private data class HowStep(
    val icon: ImageVector,
    @StringRes val title: Int,
    @StringRes val summary: Int,
    @StringRes val body: Int,
)

private val howSteps =
    listOf(
        HowStep(Icons.Filled.Sms, R.string.how_step1_short, R.string.how_step1_summary, R.string.how_step1_body),
        HowStep(Icons.Filled.Lock, R.string.how_step2_short, R.string.how_step2_summary, R.string.how_step2_body),
        HowStep(Icons.Filled.Lightbulb, R.string.how_step3_short, R.string.how_step3_summary, R.string.how_step3_body),
        HowStep(Icons.Filled.Layers, R.string.how_step4_short, R.string.how_step4_summary, R.string.how_step4_body),
        HowStep(
            Icons.Filled.NotificationsActive,
            R.string.how_step5_short,
            R.string.how_step5_summary,
            R.string.how_step5_body,
        ),
    )

private val privacyStep =
    HowStep(Icons.Filled.Shield, R.string.how_privacy_title, R.string.how_privacy_summary, R.string.how_privacy_body)

@Composable
fun HowItWorksScreen(navController: NavController) {
    var open by rememberSaveable { mutableStateOf<Int?>(null) }
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black),
    ) {
        IosTopBar(
            title = stringResource(R.string.how_it_works_how_bantai_works),
            onBack = { navController.popBackStack() },
        )
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            // Bottom clearance matches the floating tab bar's footprint (see
            // MainScreen) -- this screen now renders behind that persistent bar.
            contentPadding = PaddingValues(bottom = LocalBottomBarClearance.current),
        ) {
            item { GroupedSectionHeader(stringResource(R.string.how_section_steps)) }
            itemsIndexed(howSteps) { index, step ->
                Column(Modifier.groupedItem(index, howSteps.lastIndex)) {
                    StepRow(step, number = index + 1, expanded = open == index) {
                        open = if (open == index) null else index
                    }
                    if (index != howSteps.lastIndex) GroupedRowDivider()
                }
            }
            item { GroupedSectionHeader(stringResource(R.string.how_privacy_title)) }
            item {
                Column(Modifier.groupedItem(0, 0)) {
                    StepRow(privacyStep, number = null, expanded = open == PRIVACY_ROW) {
                        open = if (open == PRIVACY_ROW) null else PRIVACY_ROW
                    }
                }
            }
        }
    }
}

@Composable
private fun StepRow(
    step: HowStep,
    number: Int?,
    expanded: Boolean,
    onToggle: () -> Unit,
) {
    val title = stringResource(step.title)
    GroupedRow(
        icon = step.icon,
        tint = Indigo,
        title = if (number != null) "$number. $title" else title,
        summary = stringResource(step.summary),
        expanded = expanded,
        onClick = onToggle,
        expandedContent = {
            Text(stringResource(step.body), color = TextSecondary, fontSize = TextSize.Footnote, lineHeight = 19.sp)
        },
    )
}

private const val PRIVACY_ROW = -1
