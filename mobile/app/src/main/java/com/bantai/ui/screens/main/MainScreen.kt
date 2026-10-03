package com.bantai.ui.screens.main

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.Layout
import androidx.navigation.NavController
import com.bantai.ui.components.LocalBottomBarClearance
import com.bantai.ui.screens.settings.SettingsScreen
import com.bantai.viewmodel.AlertsViewModel
import com.bantai.viewmodel.SettingsViewModel

/**
 * True inside the tab that's on screen. Tabs stay composed in the background
 * after their first visit (see MainScreen), so anything that should only act
 * while its tab is showing -- a BackHandler, a refresh-on-open -- checks this.
 */
val LocalTabActive = compositionLocalOf { true }

// The tab-switching content behind the floating bar -- the bar itself now
// lives at the navigation root (see NavGraph) so it can persist across
// browsing sub-screens too, not just these four tabs.
//
// A tab is built once, on its first visit, and then kept: switching only shows
// a screen that already exists. Rebuilding the whole tab on every switch (the
// old AnimatedContent) cost one ~150ms frame mid-animation, which read as a
// stutter; a kept tab also keeps its scroll position.
//
// Like iOS, the content switches instantly -- only the tab bar's pill moves.
// A cross-fade meant drawing two full tabs every frame for its duration, and
// with Messages and Scam Waves that was enough to drop frames on a mid-range
// phone; an instant switch draws just the new tab, once.
@Composable
fun MainScreen(
    navController: NavController,
    settingsViewModel: SettingsViewModel,
    // Hoisted to NavGraph so it survives tab switches and also feeds the tab
    // bar's Alerts count.
    alertsViewModel: AlertsViewModel,
    selectedTab: Int,
) {
    // Content draws edge to edge behind the floating bar.
    val contentPadding = PaddingValues(bottom = LocalBottomBarClearance.current)
    val visited = remember { mutableStateListOf<Int>() }
    if (selectedTab !in visited) visited.add(selectedTab)

    Box(Modifier.fillMaxSize()) {
        visited.forEach { tab ->
            key(tab) {
                val active = tab == selectedTab
                KeptTab(shown = active) {
                    CompositionLocalProvider(LocalTabActive provides active) {
                        when (tab) {
                            0 -> MessagesScreen(navController, contentPadding)
                            1 -> AlertsScreen(navController, contentPadding, alertsViewModel)
                            2 -> CampaignsScreen(navController, contentPadding)
                            3 -> SettingsScreen(contentPadding, navController, settingsViewModel)
                        }
                    }
                }
            }
        }
    }
}

/**
 * Keeps [content] composed but, while not [shown], skips measuring, placing
 * and drawing it -- so a background tab costs nothing per frame, can't be
 * tapped, and isn't read out by TalkBack, yet comes back instantly.
 */
@Composable
private fun KeptTab(
    shown: Boolean,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Layout(content = content, modifier = modifier.fillMaxSize()) { measurables, constraints ->
        if (!shown) {
            layout(constraints.minWidth, constraints.minHeight) {}
        } else {
            val placeables = measurables.map { it.measure(constraints) }
            layout(constraints.maxWidth, constraints.maxHeight) {
                placeables.forEach { it.place(0, 0) }
            }
        }
    }
}
