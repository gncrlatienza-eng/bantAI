package com.bantai.data

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * Fires when any backend call comes back 401 (expired/invalid JWT). NavGraph
 * collects this to drop the user back to re-authentication — without it, a
 * dead token just makes every backend call fail the same generic way forever
 * (silent permanent fallback to the on-device heuristic, no path back to
 * login short of manually finding Settings > Delete Account).
 */
object AuthEventBus {
    private val _sessionExpired = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val sessionExpired: SharedFlow<Unit> = _sessionExpired.asSharedFlow()

    fun notifySessionExpired() {
        _sessionExpired.tryEmit(Unit)
    }
}
