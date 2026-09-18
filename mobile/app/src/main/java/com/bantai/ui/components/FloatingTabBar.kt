package com.bantai.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.outlined.Campaign
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.runtime.toMutableStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInParent
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.GlassFill
import com.bantai.ui.theme.GlassStroke
import com.bantai.ui.theme.Indigo
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.HazeStyle
import dev.chrisbanes.haze.HazeTint
import dev.chrisbanes.haze.hazeEffect

private data class NavTab(
    val label: String,
    val icon: ImageVector,
    val selectedIcon: ImageVector,
)

private val navTabs =
    listOf(
        NavTab("Messages", Icons.Outlined.ChatBubbleOutline, Icons.Filled.ChatBubble),
        NavTab("Alerts", Icons.Outlined.Notifications, Icons.Filled.Notifications),
        NavTab("Campaigns", Icons.Outlined.Campaign, Icons.Filled.Campaign),
        NavTab("Settings", Icons.Outlined.Settings, Icons.Filled.Settings),
    )

private const val UNSELECTED_TAB_COLOR = 0xFF8E8E93
private val Unselected = Color(UNSELECTED_TAB_COLOR)

private const val TAB_BAR_HEIGHT_DP = 74
private const val TAB_TINT_ANIMATION_MS = 200

// Each tab gets an equal-width slice of the bar (Modifier.weight(1f)) so the
// icons land at consistent, evenly-spaced positions regardless of how long
// each tab's label is -- sizing tabs to their own label width instead made
// the gaps between column edges equal but left the icons themselves unevenly
// spaced, since a wide label like "Campaigns" pushed its icon further from
// its neighbors than a short one like "Alerts". The selected tab still shows
// a pill tightly fitted to its slice's measured bounds.
// Two ways to switch tabs:
//   - A plain tap anywhere in the bar selects whatever tab is under it.
//   - A long-press then drag turns the bar into a slider: the pill tracks the
//     finger continuously across tabs (haptic tick on each crossing),
//     previewing the tint live; lifting commits whichever tab it's over.
// The pill itself is real backdrop blur (Haze), not a flat tint -- screen
// content actually glassifies wherever it slides behind, per the reference.
//
// Hoisted out of MainScreen so it can sit at the navigation root and persist
// across every "browsing" screen, not just the four main tabs -- see NavGraph.
@Composable
fun FloatingTabBar(
    selected: Int,
    hazeState: HazeState,
    onSelect: (Int) -> Unit,
) {
    val density = LocalDensity.current
    val haptics = LocalHapticFeedback.current
    var dragActive by remember { mutableStateOf(false) }
    var hoverIndex by remember { mutableIntStateOf(selected) }

    // Each TabItem reports its own measured position/size here as it's laid
    // out (see onGloballyPositioned below) -- the pill animates to whichever
    // entry is the current target, so it always matches real content bounds
    // instead of an assumed uniform width.
    val tabBounds = remember { List(navTabs.size) { Rect.Zero }.toMutableStateList() }

    fun indexAt(x: Float): Int {
        val hit = tabBounds.indexOfFirst { x >= it.left && x < it.right }
        if (hit >= 0) return hit
        // Between/outside measured tabs (bar padding, or before first layout) --
        // fall back to whichever tab's center is nearest.
        return tabBounds.indices.minByOrNull { kotlin.math.abs(tabBounds[it].center.x - x) } ?: 0
    }

    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .shadow(24.dp, RoundedCornerShape(30.dp), ambientColor = Black, spotColor = Black)
                .clip(RoundedCornerShape(30.dp))
                .background(GlassFill)
                .border(1.dp, GlassStroke, RoundedCornerShape(30.dp))
                .height(TAB_BAR_HEIGHT_DP.dp)
                .pointerInput(Unit) {
                    detectTapGestures(onTap = { offset -> onSelect(indexAt(offset.x)) })
                }.pointerInput(Unit) {
                    detectDragGesturesAfterLongPress(
                        onDragStart = { offset ->
                            dragActive = true
                            hoverIndex = indexAt(offset.x)
                            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        },
                        onDrag = { change, _ ->
                            change.consume()
                            val newIndex = indexAt(change.position.x)
                            if (newIndex != hoverIndex) {
                                hoverIndex = newIndex
                                haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                            }
                        },
                        onDragEnd = {
                            onSelect(hoverIndex)
                            dragActive = false
                        },
                        onDragCancel = { dragActive = false },
                    )
                },
    ) {
        val targetIndex = if (dragActive) hoverIndex else selected
        val targetBounds = tabBounds.getOrElse(targetIndex) { Rect.Zero }

        if (targetBounds != Rect.Zero) {
            TabSelectionPill(targetBounds = targetBounds, density = density, hazeState = hazeState)
        }

        TabBarItems(selected = selected, dragActive = dragActive, hoverIndex = hoverIndex, tabBounds = tabBounds)
    }
}

@Composable
private fun TabSelectionPill(
    targetBounds: Rect,
    density: Density,
    hazeState: HazeState,
) {
    val pillOffset by animateDpAsState(
        targetValue = with(density) { targetBounds.left.toDp() },
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMediumLow),
        label = "pillOffset",
    )
    val pillWidth by animateDpAsState(
        targetValue = with(density) { targetBounds.width.toDp() },
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMediumLow),
        label = "pillWidth",
    )
    Box(
        modifier =
            Modifier
                .offset(x = pillOffset)
                .width(pillWidth)
                .fillMaxHeight()
                .padding(6.dp)
                .clip(RoundedCornerShape(22.dp))
                // Real backdrop blur -- glassifies whatever screen content
                // (e.g. message text) is currently behind the pill.
                .hazeEffect(
                    state = hazeState,
                    style = HazeStyle(tint = HazeTint(Indigo.copy(alpha = 0.22f)), blurRadius = 18.dp),
                ),
    )
}

@Composable
private fun TabBarItems(
    selected: Int,
    dragActive: Boolean,
    hoverIndex: Int,
    tabBounds: SnapshotStateList<Rect>,
) {
    Row(
        modifier = Modifier.fillMaxWidth().fillMaxHeight(),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        navTabs.forEachIndexed { index, tab ->
            TabItem(
                tab = tab,
                selected = if (dragActive) hoverIndex == index else selected == index,
                modifier =
                    Modifier
                        .weight(1f)
                        .onGloballyPositioned { coordinates ->
                            tabBounds[index] = coordinates.boundsInParent()
                        },
            )
        }
    }
}

@Composable
private fun TabItem(
    tab: NavTab,
    selected: Boolean,
    modifier: Modifier = Modifier,
) {
    val tint by animateColorAsState(
        targetValue = if (selected) Indigo else Unselected,
        animationSpec = tween(TAB_TINT_ANIMATION_MS),
        label = "tabTint",
    )
    // A small bounce on the icon itself when it becomes selected/hovered, on
    // top of the sliding pill -- two coordinated motions read as more
    // deliberate than either alone.
    val iconScale by animateFloatAsState(
        targetValue = if (selected) 1.1f else 1f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMedium),
        label = "tabIconScale",
    )
    Column(
        modifier = modifier.fillMaxHeight().padding(horizontal = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            imageVector = if (selected) tab.selectedIcon else tab.icon,
            contentDescription = tab.label,
            tint = tint,
            modifier = Modifier.size(22.dp).scale(iconScale),
        )
        Spacer(Modifier.height(0.dp))
        Text(
            tab.label,
            color = tint,
            fontSize = 10.sp,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
            maxLines = 1,
        )
    }
}
