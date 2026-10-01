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
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Layers
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.runtime.toMutableStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
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
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.GlassFill
import com.bantai.ui.theme.GlassStroke
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.White
import dev.chrisbanes.haze.HazeInputScale
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.HazeStyle
import dev.chrisbanes.haze.HazeTint
import dev.chrisbanes.haze.hazeEffect

// [id] is the tab's fixed index (selectedTab, MainScreen, notification deep
// links); it stays put when Scam Waves is hidden, so Settings is always 3.
private data class NavTab(
    val id: Int,
    val label: String,
    val icon: ImageVector,
    val selectedIcon: ImageVector,
)

const val SCAM_WAVES_TAB_ID = 2
private const val SETTINGS_TAB_ID = 3

private val navTabs =
    listOf(
        NavTab(0, "Messages", Icons.Outlined.ChatBubbleOutline, Icons.Filled.ChatBubble),
        NavTab(1, "Alerts", Icons.Outlined.Notifications, Icons.Filled.Notifications),
        NavTab(SCAM_WAVES_TAB_ID, "Scam Waves", Icons.Outlined.Layers, Icons.Filled.Layers),
        NavTab(SETTINGS_TAB_ID, "Settings", Icons.Outlined.Settings, Icons.Filled.Settings),
    )

private const val UNSELECTED_TAB_COLOR = 0xFF8E8E93
private val Unselected = Color(UNSELECTED_TAB_COLOR)

private const val TAB_BAR_HEIGHT_DP = 74
private const val DOCKED_TAB_BAR_HEIGHT_DP = 64
private const val ALERTS_TAB_INDEX = 1

/** Height of the bar itself in each style; NavGraph adds the margins and system insets. */
fun tabBarHeight(docked: Boolean): Dp = if (docked) DOCKED_TAB_BAR_HEIGHT_DP.dp else TAB_BAR_HEIGHT_DP.dp

/**
 * How much space at the bottom of the screen the tab bar (plus the system
 * navigation bar under it) covers, so scrolling content can end above it.
 * Provided by NavGraph from the real insets -- it used to be a fixed 116dp
 * everywhere, which the bar outgrew on phones with 3-button navigation and
 * hid the last rows of every list.
 */
val LocalBottomBarClearance = compositionLocalOf { 116.dp }
private const val MAX_BADGE = 99
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
//
// [docked]: a plain full-width bar attached to the bottom edge instead of the
// floating pill. NavGraph picks it automatically on phones using 3-button
// navigation, where a floating pill stacked on the button row looked like two
// bars and cost ~130dp of screen; gesture-navigation phones keep the pill.
@Composable
@Suppress("LongMethod", "LongParameterList") // one gesture-handling container for both styles
fun FloatingTabBar(
    selected: Int,
    // Alerts not opened yet; shown as a small count on the Alerts tab.
    alertsBadge: Int = 0,
    hazeState: HazeState,
    docked: Boolean = false,
    // Settings → "Show Scam Waves tab"; off by default.
    showScamWaves: Boolean = true,
    onSelect: (Int) -> Unit,
) {
    // Positions below (hover, bounds, gestures) are into this list; [selected]
    // and [onSelect] speak tab ids.
    val tabs = remember(showScamWaves) { navTabs.filter { showScamWaves || it.id != SCAM_WAVES_TAB_ID } }
    val selectedPosition = tabs.indexOfFirst { it.id == selected }.coerceAtLeast(0)
    val density = LocalDensity.current
    val haptics = LocalHapticFeedback.current
    var dragActive by remember { mutableStateOf(false) }
    var hoverIndex by remember { mutableIntStateOf(selectedPosition) }

    // pointerInput(Unit) below never restarts, so without this its gesture
    // handlers kept calling the onSelect from the first composition -- whose
    // captured route said "main" -- and tapping a tab from a detail screen
    // (alert, campaign, settings page) changed the tab but never navigated.
    val currentOnSelect by rememberUpdatedState<(Int) -> Unit> { position -> onSelect(tabs[position].id) }

    // Each TabItem reports its own measured position/size here as it's laid
    // out (see onGloballyPositioned below) -- the pill animates to whichever
    // entry is the current target, so it always matches real content bounds
    // instead of an assumed uniform width.
    val tabBounds = remember(tabs) { List(tabs.size) { Rect.Zero }.toMutableStateList() }

    fun indexAt(x: Float): Int {
        val hit = tabBounds.indexOfFirst { x >= it.left && x < it.right }
        if (hit >= 0) return hit
        // Between/outside measured tabs (bar padding, or before first layout) --
        // fall back to whichever tab's center is nearest.
        return tabBounds.indices.minByOrNull { kotlin.math.abs(tabBounds[it].center.x - x) } ?: 0
    }

    val hairline = GlassStroke
    val container =
        if (docked) {
            // Background comes from NavGraph, which also runs it behind the
            // system buttons; the bar only draws its top hairline.
            Modifier
                .fillMaxWidth()
                .drawBehind { drawLine(hairline, Offset.Zero, Offset(size.width, 0f), strokeWidth = 1.dp.toPx()) }
        } else {
            Modifier
                .fillMaxWidth()
                .shadow(24.dp, RoundedCornerShape(30.dp), ambientColor = Color.Black, spotColor = Color.Black)
                .clip(RoundedCornerShape(30.dp))
                .background(GlassFill)
                .border(1.dp, GlassStroke, RoundedCornerShape(30.dp))
        }
    Box(
        modifier =
            container
                .height(tabBarHeight(docked))
                // Keyed on the tab list: indexAt reads that list's bounds.
                .pointerInput(tabs) {
                    detectTapGestures(onTap = { offset -> currentOnSelect(indexAt(offset.x)) })
                }.pointerInput(tabs) {
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
                            currentOnSelect(hoverIndex)
                            dragActive = false
                        },
                        onDragCancel = { dragActive = false },
                    )
                },
    ) {
        val targetIndex = if (dragActive) hoverIndex else selectedPosition
        val targetBounds = tabBounds.getOrElse(targetIndex) { Rect.Zero }

        if (targetBounds != Rect.Zero) {
            TabSelectionPill(targetBounds = targetBounds, density = density, hazeState = hazeState)
        }

        TabBarItems(
            tabs = tabs,
            selected = selectedPosition,
            dragActive = dragActive,
            hoverIndex = hoverIndex,
            tabBounds = tabBounds,
            alertsBadge = alertsBadge,
        )
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
                .border(0.75.dp, White.copy(alpha = 0.22f), RoundedCornerShape(22.dp))
                // Real backdrop blur -- glassifies whatever screen content
                // (e.g. message text) is currently behind the pill.
                // backgroundColor is required on Android 12+, where Haze uses a
                // real RenderEffect blur: without it, drawing the pill threw
                // "backgroundColor not specified" and crashed the app on the
                // first frame of the main screen (seen on a Galaxy S24 FE,
                // Android 16). Android 10 and older use a fallback path that
                // never reads it, which is why the Huawei was unaffected.
                .hazeEffect(
                    state = hazeState,
                    style =
                        HazeStyle(
                            backgroundColor = Black,
                            // Clear frosted glass, not purple: a faint label-color
                            // tint plus the hairline edge below keeps the selection
                            // visible in both themes without a solid fill.
                            tint = HazeTint(White.copy(alpha = 0.06f)),
                            blurRadius = 18.dp,
                        ),
                ) {
                    // Blur a downscaled copy of the content: visually the same
                    // behind a small tinted pill, far cheaper per frame. The
                    // full-resolution blur made tab switches stutter on
                    // Android 12+ (real RenderEffect blur), e.g. the Galaxy S24 FE.
                    inputScale = HazeInputScale.Auto
                },
    )
}

@Composable
@Suppress("LongParameterList") // tab list plus the gesture state it draws
private fun TabBarItems(
    tabs: List<NavTab>,
    selected: Int,
    dragActive: Boolean,
    hoverIndex: Int,
    tabBounds: SnapshotStateList<Rect>,
    alertsBadge: Int,
) {
    Row(
        modifier = Modifier.fillMaxWidth().fillMaxHeight(),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        tabs.forEachIndexed { index, tab ->
            TabItem(
                tab = tab,
                badge = if (tab.id == ALERTS_TAB_INDEX) alertsBadge else 0,
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
    badge: Int,
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
    // Small side padding only: each tab is already a quarter of the bar, and
    // 16dp per side left ~55dp on a 1080px-wide phone, clipping "Campaigns"
    // to "Campaig". The pill uses the slice bounds, so this doesn't change it.
    Column(
        modifier = modifier.fillMaxHeight().padding(horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box {
            Icon(
                imageVector = if (selected) tab.selectedIcon else tab.icon,
                contentDescription = if (badge > 0) "${tab.label}, $badge new" else tab.label,
                tint = tint,
                modifier = Modifier.size(22.dp).scale(iconScale),
            )
            if (badge > 0) {
                // iOS-style red count bubble on the icon's top-right corner.
                Box(
                    modifier =
                        Modifier
                            .align(Alignment.TopEnd)
                            .offset(x = 9.dp, y = (-5).dp)
                            .defaultMinSize(minWidth = 16.dp, minHeight = 16.dp)
                            .background(Danger, CircleShape)
                            .padding(horizontal = 4.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        if (badge > MAX_BADGE) "$MAX_BADGE+" else badge.toString(),
                        color = Color.White,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                    )
                }
            }
        }
        Spacer(Modifier.height(0.dp))
        Text(
            tab.label,
            color = tint,
            fontSize = 10.sp,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
            maxLines = 1,
            softWrap = false,
        )
    }
}
