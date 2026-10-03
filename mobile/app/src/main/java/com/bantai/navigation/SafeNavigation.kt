package com.bantai.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.navigation.NavController

/**
 * A "go back" that only happens while the calling screen is still the one on
 * top. Use it for pops that fire later (after a network call, a dialog, an
 * effect): if the user already went back themselves, a second pop would land
 * on the screen beneath mid-transition, and Navigation Compose then leaves it
 * blank -- only the tab bar visible, every tab black.
 *
 * Inside a NavHost destination, [LocalLifecycleOwner] is that destination's
 * back stack entry, which drops below RESUMED the moment it starts leaving.
 */
@Composable
fun rememberSafePopBack(navController: NavController): () -> Unit {
    val owner: LifecycleOwner = LocalLifecycleOwner.current
    return remember(owner, navController) {
        {
            if (owner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) navController.popBackStack()
        }
    }
}
