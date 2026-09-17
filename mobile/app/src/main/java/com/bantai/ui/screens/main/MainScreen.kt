package com.bantai.ui.screens.main

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.ui.screens.settings.SettingsScreen
import com.bantai.viewmodel.AlertsViewModel
import com.bantai.viewmodel.SettingsViewModel

private const val TAB_FADE_IN_MS = 220
private const val TAB_FADE_OUT_MS = 140

// The tab-switching content behind the floating bar -- the bar itself now
// lives at the navigation root (see NavGraph) so it can persist across
// browsing sub-screens too, not just these four tabs.
@Composable
fun MainScreen(
    navController: NavController,
    settingsViewModel: SettingsViewModel,
    selectedTab: Int,
) {
    // Hoisted here (rather than left as AlertsScreen's default viewModel())
    // so it survives tab switches instead of being recreated each time.
    val alertsViewModel: AlertsViewModel = viewModel()

    // Content draws edge to edge behind the floating bar.
    val contentPadding = PaddingValues(bottom = 116.dp)

    AnimatedContent(
        targetState = selectedTab,
        transitionSpec = {
            // Slides toward the tab's position in the bar (right when moving to a
            // later tab, left when moving to an earlier one) instead of a flat
            // cross-fade, so the transition reads as "switching tabs" rather than
            // an unrelated screen swap.
            val direction = if (targetState > initialState) 1 else -1
            (
                slideInHorizontally(tween(TAB_FADE_IN_MS)) { width -> direction * width / 5 } +
                    fadeIn(tween(TAB_FADE_IN_MS))
            ) togetherWith
                (
                    slideOutHorizontally(tween(TAB_FADE_OUT_MS)) { width -> -direction * width / 5 } +
                        fadeOut(tween(TAB_FADE_OUT_MS))
                )
        },
        label = "tab_content",
    ) { tab ->
        when (tab) {
            0 -> MessagesScreen(navController, contentPadding)
            1 -> AlertsScreen(navController, contentPadding, alertsViewModel)
            2 -> CampaignsScreen(navController, contentPadding)
            3 -> SettingsScreen(contentPadding, navController, settingsViewModel)
        }
    }
}
