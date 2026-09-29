package com.bantai.ui.components

import android.Manifest
import android.content.pm.PackageManager
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat

/**
 * Runs a send only once SEND_SMS is granted, asking for it first when it isn't.
 *
 * SEND_SMS is granted automatically while BantAI is the default SMS app, but
 * Android revokes it when another app takes that role -- after which every
 * send failed with a generic "failed to send". Asking at the moment of sending
 * lets the user fix it in place, and the message goes out right after.
 */
@Composable
fun rememberSmsSendPermission(): (onGranted: () -> Unit) -> Unit {
    val context = LocalContext.current
    val pendingSend = remember { mutableStateOf<(() -> Unit)?>(null) }
    val launcher =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            val send = pendingSend.value
            pendingSend.value = null
            if (granted) {
                send?.invoke()
            } else {
                Toast
                    .makeText(
                        context,
                        "BantAI needs SMS permission to send. " +
                            "Allow it in Settings, or set BantAI as your default SMS app.",
                        Toast.LENGTH_LONG,
                    ).show()
            }
        }
    return remember(launcher) {
        { onGranted ->
            val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS)
            if (granted == PackageManager.PERMISSION_GRANTED) {
                onGranted()
            } else {
                pendingSend.value = onGranted
                launcher.launch(Manifest.permission.SEND_SMS)
            }
        }
    }
}
