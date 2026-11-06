package com.bantai.util

import androidx.lifecycle.Lifecycle
import androidx.navigation.NavController

/**
 * False while a navigation is already under way (the current screen is
 * leaving or arriving). Guarding a navigate() with it stops a quick double tap
 * from pushing the same screen twice.
 */
fun NavController.isResumed(): Boolean = currentBackStackEntry?.lifecycle?.currentState == Lifecycle.State.RESUMED
