package com.bantai.util

import android.app.ActivityManager
import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext

/**
 * Budget phones Android itself classes as low-RAM. Expensive per-frame effects
 * (the tab bar's backdrop blur) are swapped for flat equivalents on these.
 */
fun isLowRamDevice(context: Context): Boolean {
    val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
    return activityManager?.isLowRamDevice == true
}

@Composable
fun rememberIsLowRamDevice(): Boolean {
    val context = LocalContext.current
    return remember(context) { isLowRamDevice(context) }
}
