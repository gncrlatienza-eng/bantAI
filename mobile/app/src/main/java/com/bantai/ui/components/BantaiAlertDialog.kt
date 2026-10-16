package com.bantai.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White

/**
 * bantAI's pop-up, drawn like an iOS alert instead of Material's: a rounded
 * card with a centered title and message, and full-width buttons split by
 * hairlines (Cancel on the left, the action on the right). Same slots as
 * Material's AlertDialog, so any dialog can switch over.
 *
 * Two buttons sit side by side; [stackButtons] puts them one above the other
 * (action first) for labels too long to share a line. A null [confirmButton]
 * leaves just the dismiss button, for pickers that act on a tap in [text].
 */
@Composable
@Suppress("LongParameterList") // mirrors Material's AlertDialog slots
fun BantaiAlertDialog(
    onDismissRequest: () -> Unit,
    confirmButton: (@Composable () -> Unit)?,
    modifier: Modifier = Modifier,
    dismissButton: (@Composable () -> Unit)? = null,
    icon: (@Composable () -> Unit)? = null,
    title: (@Composable () -> Unit)? = null,
    text: (@Composable () -> Unit)? = null,
    stackButtons: Boolean = false,
    properties: DialogProperties = DialogProperties(),
) {
    Dialog(
        onDismissRequest = onDismissRequest,
        properties =
            DialogProperties(
                dismissOnBackPress = properties.dismissOnBackPress,
                dismissOnClickOutside = properties.dismissOnClickOutside,
                usePlatformDefaultWidth = false,
            ),
    ) {
        Column(
            modifier =
                modifier
                    .padding(horizontal = 40.dp)
                    .widthIn(max = 340.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(SurfaceElevated),
        ) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 20.dp, bottom = 18.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                icon?.let {
                    CompositionLocalProvider(LocalContentColor provides Indigo) { it() }
                    Spacer(Modifier.height(10.dp))
                }
                title?.let {
                    ProvideTextStyle(
                        TextStyle(
                            color = White,
                            fontSize = TextSize.Headline,
                            fontWeight = FontWeight.SemiBold,
                            textAlign = TextAlign.Center,
                        ),
                    ) { it() }
                }
                text?.let {
                    if (title != null) Spacer(Modifier.height(6.dp))
                    Box(Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState())) {
                        ProvideTextStyle(
                            TextStyle(
                                color = TextSecondary,
                                fontSize = TextSize.Footnote,
                                lineHeight = 18.sp,
                                textAlign = TextAlign.Center,
                            ),
                        ) { it() }
                    }
                }
            }
            HorizontalDivider(color = Hairline, thickness = 0.5.dp)
            DialogButtons(confirmButton, dismissButton, stackButtons)
        }
    }
}

@Composable
private fun DialogButtons(
    confirm: (@Composable () -> Unit)?,
    dismiss: (@Composable () -> Unit)?,
    stack: Boolean,
) {
    if (confirm != null && dismiss != null && !stack) {
        Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
            ButtonCell(Modifier.weight(1f), dismiss)
            VerticalDivider(color = Hairline, thickness = 0.5.dp, modifier = Modifier.fillMaxHeight())
            ButtonCell(Modifier.weight(1f), confirm)
        }
    } else {
        confirm?.let { ButtonCell(Modifier.fillMaxWidth(), it) }
        if (confirm != null && dismiss != null) HorizontalDivider(color = Hairline, thickness = 0.5.dp)
        dismiss?.let { ButtonCell(Modifier.fillMaxWidth(), it) }
    }
}

@Composable
private fun ButtonCell(
    modifier: Modifier,
    content: @Composable () -> Unit,
) {
    Box(
        modifier.heightIn(min = 48.dp).padding(horizontal = 4.dp, vertical = 2.dp),
        contentAlignment = Alignment.Center,
    ) {
        content()
    }
}
