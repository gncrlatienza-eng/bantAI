package com.bantai.util

import android.app.role.RoleManager
import android.content.Context
import android.os.Build
import android.provider.Telephony
import android.util.Log

private const val TAG = "DefaultSmsApp"

/**
 * Whether BantAI is the phone's default SMS app, which decides whether it must
 * save messages itself (sent and received) and whether it may block numbers.
 *
 * Asks the role system (Android 10+), not Telephony.Sms.getDefaultSmsPackage.
 * On a Galaxy S23 FE (One UI) that call also tries to re-grant the default
 * app's permissions, logs "com.bantai lost android:receive_wap_push (no
 * permission to fix)" and reports no default -- while BantAI held the role.
 * Every send was then treated as a non-default send: nothing was saved, and
 * the text only lived as a temporary bubble that later vanished.
 */
object DefaultSmsApp {
    fun isDefault(context: Context): Boolean {
        val byRole =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                runCatching { context.getSystemService(RoleManager::class.java)?.isRoleHeld(RoleManager.ROLE_SMS) }
                    .getOrNull()
            } else {
                null
            }
        val byPackage = Telephony.Sms.getDefaultSmsPackage(context) == context.packageName
        // Temporary: confirms on the Samsung that the two answers disagree.
        Log.i(TAG, "role=$byRole package=$byPackage")
        return byRole ?: byPackage
    }
}
