package com.bantai.util

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.provider.Settings

// AppOpsManager.OPSTR_WRITE_SMS is hidden from the SDK; its value is stable.
private const val OP_WRITE_SMS = "android:write_sms"

/**
 * Whether Android actually lets BantAI save messages to the phone's SMS store.
 *
 * Becoming the default SMS app is supposed to allow the WRITE_SMS app-op, but
 * on a Galaxy S24 FE (One UI, Android 16) it was left at "ignore" for the app
 * while the role was granted. Every write is then silently dropped: sent
 * messages never appear in Messages, and the provider even reports success.
 * Re-choosing the default SMS app makes Android grant it properly.
 */
object SmsWriteAccess {
    /** True when BantAI is the default SMS app but its writes are being dropped. */
    fun isBlocked(context: Context): Boolean {
        if (!BlockHelper.isDefaultSmsApp(context)) return false
        val appOps = context.getSystemService(AppOpsManager::class.java) ?: return false
        val mode =
            runCatching {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    appOps.unsafeCheckOpNoThrow(OP_WRITE_SMS, Process.myUid(), context.packageName)
                } else {
                    @Suppress("DEPRECATION")
                    appOps.checkOpNoThrow(OP_WRITE_SMS, Process.myUid(), context.packageName)
                }
            }.getOrDefault(AppOpsManager.MODE_ALLOWED)
        return mode != AppOpsManager.MODE_ALLOWED && mode != AppOpsManager.MODE_DEFAULT
    }

    /** The phone's "Default apps" settings, where the SMS app can be re-chosen. */
    fun fixIntent(): Intent {
        val intent = Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS)
        return intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
}
