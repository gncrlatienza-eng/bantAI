package com.bantai.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

private const val TAG = "WapPushReceiver"

class WapPushReceiver : BroadcastReceiver() {
    override fun onReceive(
        context: Context,
        intent: Intent,
    ) {
        // MMS/WAP-push parsing is not implemented yet (a real feature, tracked
        // separately from Sprint 5's bug bash). This log exists so the drop is
        // visible instead of silently swallowing a potential smishing vector.
        Log.w(TAG, "Received ${intent.action}; MMS/WAP-push messages are not scanned or stored.")
    }
}
