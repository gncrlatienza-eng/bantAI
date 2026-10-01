package com.bantai.ui.screens.settings

import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.ui.components.LocalBottomBarClearance
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White

// Every field is a string resource id, resolved on screen.
private data class TipContent(
    @StringRes val quote: Int,
    @StringRes val whatIsIt: Int,
    @StringRes val redFlagTitle: Int,
    val redFlags: List<Int>,
    @StringRes val whatToDo: Int,
)

@Suppress("LongMethod") // one branch per tip article
private fun tipContent(tip: String): TipContent =
    when (tip) {
        "gcash" ->
            TipContent(
                quote = R.string.tips_gcash_quote,
                whatIsIt = R.string.tips_gcash_what,
                redFlagTitle = R.string.tips_red_flags_title,
                redFlags =
                    listOf(
                        R.string.tips_gcash_flag1,
                        R.string.tips_gcash_flag2,
                        R.string.tips_gcash_flag3,
                        R.string.tips_gcash_flag4,
                    ),
                whatToDo = R.string.tips_gcash_todo,
            )

        "urgency" ->
            TipContent(
                quote = R.string.tips_urgency_quote,
                whatIsIt = R.string.tips_urgency_what,
                redFlagTitle = R.string.tips_urgency_flags_title,
                redFlags =
                    listOf(
                        R.string.tips_urgency_flag1,
                        R.string.tips_urgency_flag2,
                        R.string.tips_urgency_flag3,
                        R.string.tips_urgency_flag4,
                    ),
                whatToDo = R.string.tips_urgency_todo,
            )

        "links" ->
            TipContent(
                quote = R.string.tips_links_quote,
                whatIsIt = R.string.tips_links_what,
                redFlagTitle = R.string.tips_links_flags_title,
                redFlags =
                    listOf(
                        R.string.tips_links_flag1,
                        R.string.tips_links_flag2,
                        R.string.tips_links_flag3,
                        R.string.tips_links_flag4,
                    ),
                whatToDo = R.string.tips_links_todo,
            )

        "otp" ->
            TipContent(
                quote = R.string.tips_otp_quote,
                whatIsIt = R.string.tips_otp_what,
                redFlagTitle = R.string.tips_otp_flags_title,
                redFlags =
                    listOf(
                        R.string.tips_otp_flag1,
                        R.string.tips_otp_flag2,
                        R.string.tips_otp_flag3,
                        R.string.tips_otp_flag4,
                    ),
                whatToDo = R.string.tips_otp_todo,
            )

        "action" ->
            TipContent(
                quote = R.string.tips_action_quote,
                whatIsIt = R.string.tips_action_what,
                redFlagTitle = R.string.tips_action_flags_title,
                redFlags =
                    listOf(
                        R.string.tips_action_flag1,
                        R.string.tips_action_flag2,
                        R.string.tips_action_flag3,
                        R.string.tips_action_flag4,
                    ),
                whatToDo = R.string.tips_action_todo,
            )

        "shap" ->
            TipContent(
                quote = R.string.tips_shap_quote,
                whatIsIt = R.string.tips_shap_what,
                redFlagTitle = R.string.tips_shap_flags_title,
                redFlags =
                    listOf(
                        R.string.tips_shap_flag1,
                        R.string.tips_shap_flag2,
                        R.string.tips_shap_flag3,
                        R.string.tips_shap_flag4,
                    ),
                whatToDo = R.string.tips_shap_todo,
            )

        else ->
            TipContent(
                quote = R.string.tips_general_quote,
                whatIsIt = R.string.tips_general_what,
                redFlagTitle = R.string.tips_red_flags_title,
                redFlags =
                    listOf(
                        R.string.tips_general_flag1,
                        R.string.tips_general_flag2,
                        R.string.tips_general_flag3,
                        R.string.tips_general_flag4,
                    ),
                whatToDo = R.string.tips_general_todo,
            )
    }

private fun tipTitle(tip: String): Int =
    when (tip) {
        "gcash" -> R.string.tips_gcash_title
        "urgency" -> R.string.tips_urgency_title
        "links" -> R.string.tips_links_title
        "otp" -> R.string.tips_otp_title
        "action" -> R.string.tips_action_title
        "shap" -> R.string.tips_shap_title
        else -> R.string.tips_general_title
    }

@Composable
@Suppress("LongMethod", "MaxLineLength")
fun TipDetailScreen(
    tip: String,
    navController: NavController,
) {
    val title = stringResource(tipTitle(tip))
    val content = tipContent(tip)

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
                stringResource(R.string.tip_detail_tip),
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
            contentPadding = PaddingValues(start = 24.dp, top = 16.dp, end = 24.dp, bottom = LocalBottomBarClearance.current),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                Text(title, color = White, fontWeight = FontWeight.Bold, fontSize = TextSize.Title)
                Spacer(Modifier.height(4.dp))
                Text(stringResource(R.string.tip_detail_bantai_education_3_min_read), color = TextSecondary, fontSize = TextSize.Caption)
            }

            item {
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(Indigo.copy(alpha = 0.15f), RoundedCornerShape(12.dp))
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
                        stringResource(content.quote),
                        color = Indigo,
                        fontSize = TextSize.Footnote,
                        fontStyle = FontStyle.Italic,
                    )
                }
            }

            item {
                SectionHeading(stringResource(R.string.tips_what_is_it))
                Spacer(Modifier.height(8.dp))
                Text(
                    stringResource(content.whatIsIt),
                    color = TextSecondary,
                    fontSize = TextSize.Subhead,
                    lineHeight = 22.sp,
                )
            }

            item {
                SectionHeading(stringResource(content.redFlagTitle))
                Spacer(Modifier.height(8.dp))
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    content.redFlags.forEach { flag ->
                        BulletPoint(stringResource(flag))
                    }
                }
            }

            item {
                SectionHeading(stringResource(R.string.tips_what_to_do))
                Spacer(Modifier.height(8.dp))
                Text(
                    stringResource(content.whatToDo),
                    color = TextSecondary,
                    fontSize = TextSize.Subhead,
                    lineHeight = 22.sp,
                )
            }
        }
    }
}

@Composable
private fun SectionHeading(text: String) {
    Text(text, color = White, fontWeight = FontWeight.Bold, fontSize = TextSize.Body)
}

@Composable
private fun BulletPoint(text: String) {
    Row(verticalAlignment = Alignment.Top) {
        Text("·  ", color = TextSecondary, fontSize = TextSize.Subhead)
        Text(text, color = TextSecondary, fontSize = TextSize.Subhead, lineHeight = 22.sp)
    }
}
