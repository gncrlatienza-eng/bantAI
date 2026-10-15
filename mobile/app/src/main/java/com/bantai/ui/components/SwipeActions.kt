package com.bantai.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Block
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.GppBad
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import com.bantai.R
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.IosBlue
import com.bantai.ui.theme.OnAccent
import com.bantai.ui.theme.TextSize
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

// What a swiped row asks for, as Take Action's preselects: Report with Scam
// picked (so Block follows), plain Report for a name that can't be blocked,
// or Block alone when the user has turned off sending reports.
const val SWIPE_REPORT = "report"
const val SWIPE_REPORT_BLOCK = "report_block"
const val SWIPE_BLOCK = "block"

private val SWIPE_ACTION_WIDTH = 104.dp
private const val SWIPE_FLING_VELOCITY = 1200f

/**
 * The one action a flagged row offers, or null for none (the row then doesn't
 * swipe): a trusted name or group can't be blocked, and with reports off
 * there's nothing left to offer it.
 */
fun swipeActionFor(
    canBlock: Boolean,
    reportsOn: Boolean,
): String? =
    when {
        reportsOn && canBlock -> SWIPE_REPORT_BLOCK
        reportsOn -> SWIPE_REPORT
        canBlock -> SWIPE_BLOCK
        else -> null
    }

/** The row of a list that's swiped open, so opening one (or scrolling) closes the rest. */
@Stable
class SwipeGroup {
    var openKey: Any? by mutableStateOf(null)
}

private val LocalSwipeGroup = staticCompositionLocalOf<SwipeGroup?> { null }

/** Wraps a list whose [SwipeActionsRow]s should close each other; [scrolling] closes them all. */
@Composable
fun SwipeGroupScope(
    scrolling: Boolean,
    content: @Composable () -> Unit,
) {
    val group = remember { SwipeGroup() }
    LaunchedEffect(scrolling) { if (scrolling) group.openKey = null }
    CompositionLocalProvider(LocalSwipeGroup provides group, content = content)
}

/**
 * A row that slides left to uncover one action on its trailing edge (the iOS
 * Mail pattern; leftward so it never fights Android's edge back gesture). Let
 * go past halfway and it stays open; tapping the action, the row itself, or
 * opening another row closes it. [action] null or [enabled] false is a plain
 * row (same layout, so toggling doesn't rebuild it). [background] must match
 * the list behind the row, so the action stays hidden until swiped.
 */
@Composable
@Suppress("LongParameterList", "LongMethod", "CyclomaticComplexMethod") // the row, its action, then the content
fun SwipeActionsRow(
    key: Any,
    enabled: Boolean,
    action: String?,
    onAction: (String) -> Unit,
    background: Color,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val active = enabled && action != null
    val density = LocalDensity.current
    val revealPx = with(density) { SWIPE_ACTION_WIDTH.toPx() }
    val offset = remember { Animatable(0f) }
    val scope = rememberCoroutineScope()
    val group = LocalSwipeGroup.current
    val close: () -> Unit = {
        scope.launch { offset.animateTo(0f) }
        if (group?.openKey == key) group.openKey = null
    }
    val pick: (String) -> Unit = { picked ->
        close()
        onAction(picked)
    }
    // Another row opened, the list scrolled, or swiping was turned off: close.
    val othersOpen = group != null && group.openKey != key
    LaunchedEffect(othersOpen, active) {
        if ((othersOpen || !active) && offset.value != 0f) offset.animateTo(0f)
    }
    val label = action?.let { stringResource(swipeLabel(it)) }
    Box(modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
        if (active && action != null && label != null) {
            Row(Modifier.matchParentSize(), horizontalArrangement = Arrangement.End) {
                SwipeAction(label, swipeIcon(action), swipeColor(action)) { pick(action) }
            }
        }
        Box(
            Modifier
                .offset { IntOffset(offset.value.roundToInt(), 0) }
                .background(background)
                .semantics {
                    // TalkBack can't swipe a row open; offer the action directly.
                    if (active && action != null && label != null) {
                        customActions =
                            listOf(
                                CustomAccessibilityAction(label) {
                                    pick(action)
                                    true
                                },
                            )
                    }
                }.draggable(
                    enabled = active,
                    orientation = Orientation.Horizontal,
                    state =
                        rememberDraggableState { delta ->
                            scope.launch { offset.snapTo((offset.value + delta).coerceIn(-revealPx, 0f)) }
                        },
                    onDragStopped = { velocity ->
                        val open = offset.value < -revealPx / 2 || velocity < -SWIPE_FLING_VELOCITY
                        if (open) {
                            group?.openKey = key
                        } else if (group?.openKey == key) {
                            group.openKey = null
                        }
                        offset.animateTo(if (open) -revealPx else 0f)
                    },
                ),
        ) {
            content()
            // While open, a tap on the row closes it instead of opening the message.
            if (offset.targetValue != 0f) {
                Box(
                    Modifier
                        .matchParentSize()
                        .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {
                            close()
                        },
                )
            }
        }
    }
}

private fun swipeLabel(action: String): Int =
    when (action) {
        SWIPE_REPORT_BLOCK -> R.string.alerts_swipe_report_block
        SWIPE_BLOCK -> R.string.alerts_swipe_block
        else -> R.string.alerts_swipe_report
    }

private fun swipeIcon(action: String): ImageVector =
    when (action) {
        SWIPE_REPORT_BLOCK -> Icons.Outlined.GppBad
        SWIPE_BLOCK -> Icons.Outlined.Block
        else -> Icons.Outlined.Flag
    }

@Composable
private fun swipeColor(action: String): Color = if (action == SWIPE_REPORT) IosBlue else Danger

@Composable
private fun SwipeAction(
    label: String,
    icon: ImageVector,
    color: Color,
    onClick: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .width(SWIPE_ACTION_WIDTH)
                .fillMaxHeight()
                .background(color)
                .clickable(onClick = onClick)
                .padding(horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(icon, contentDescription = null, tint = OnAccent, modifier = Modifier.size(20.dp))
        Spacer(Modifier.height(2.dp))
        Text(
            label,
            color = OnAccent,
            fontSize = TextSize.Caption,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
