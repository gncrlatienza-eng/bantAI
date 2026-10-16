package com.bantai.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBackIos
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.dropUnlessResumed
import com.bantai.R
import com.bantai.ui.theme.IosBlue
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White

/**
 * iOS navigation bar for pushed screens: a blue "‹ Back" on the left, a small
 * centered title, and optional [actions] on the right. Same back control as
 * the alert and Scam Wave screens, so every pushed screen reads the same.
 */
@Composable
fun IosTopBar(
    title: String?,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    backLabel: String = stringResource(R.string.action_back),
    actions: @Composable RowScope.() -> Unit = {},
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .heightIn(min = 52.dp),
    ) {
        Row(
            modifier =
                Modifier
                    .align(Alignment.CenterStart)
                    .padding(start = 4.dp)
                    .clickable(onClick = dropUnlessResumed(block = onBack))
                    .padding(horizontal = 8.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                Icons.AutoMirrored.Filled.ArrowBackIos,
                contentDescription = null,
                tint = IosBlue,
                modifier = Modifier.size(16.dp),
            )
            Spacer(Modifier.width(2.dp))
            Text(backLabel, color = IosBlue, fontSize = TextSize.Body)
        }
        if (title != null) {
            Text(
                title,
                color = White,
                fontWeight = FontWeight.SemiBold,
                fontSize = TextSize.Headline,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier =
                    Modifier
                        .align(Alignment.Center)
                        .padding(horizontal = 96.dp),
            )
        }
        Row(
            modifier = Modifier.align(Alignment.CenterEnd).padding(end = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            content = actions,
        )
    }
}
