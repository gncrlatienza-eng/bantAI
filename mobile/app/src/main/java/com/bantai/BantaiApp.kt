package com.bantai

import android.app.Application
import android.content.ComponentCallbacks2
import com.bantai.data.offline.ModelCRuntime
import com.bantai.util.NotificationHelper
import com.bantai.util.OwnNumber
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class BantaiApp : Application() {
    val container by lazy { AppContainer(this) }

    override fun onCreate() {
        super.onCreate()
        // Here, not only in MainActivity: an SMS can wake the app after an update
        // before anyone opens it, and a notification posted to a channel that
        // doesn't exist yet is silently dropped. Idempotent and cheap.
        runCatching { NotificationHelper.createNotificationChannels(this) }
        OwnNumber.start(this)
        container.shareReports // start loading it, so it's settled before any screen asks
    }

    // Android asks for memory back (backgrounded, or the phone is running low):
    // drop the on-device model, the app's largest allocation by far.
    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        @Suppress("DEPRECATION") // still delivered on all supported API levels
        if (level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW) {
            appScope.launch { ModelCRuntime.release() }
        }
    }

    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
}
