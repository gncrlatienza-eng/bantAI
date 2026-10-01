package com.bantai.util

import android.content.Context
import android.provider.Telephony
import com.bantai.container
import com.bantai.data.MmsReader
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch

/**
 * This phone's own number as the user typed it in Edit Profile ("My number").
 * Many PH SIMs don't report their number to Android, and without it a group
 * text listed the user among its own members -- so replies went to them too.
 * Kept in memory because the MMS code that needs it runs in receivers, where
 * a DataStore read would mean blocking. Stays on the phone.
 */
object OwnNumber {
    @Volatile var saved: String = ""
        private set

    /** Follows the stored value for the life of the process (called once, from BantaiApp). */
    fun start(context: Context) {
        val appContext = context.applicationContext
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            appContext.container.userPreferences.myNumber
                .distinctUntilChanged()
                .collect { number ->
                    val changed = saved.isNotEmpty() || number.isNotEmpty()
                    saved = number
                    // Group member lists are cached with the old answer; reload them.
                    if (changed) {
                        MmsReader.invalidate()
                        runCatching { appContext.contentResolver.notifyChange(Telephony.Mms.CONTENT_URI, null) }
                    }
                }
        }
    }
}
