package com.bantai.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/**
 * Message ids whose verdict is still being worked out right now -- a live SMS
 * waiting on the server, or a message queued in the inbox scan. The Messages
 * list shows these as "Checking…" instead of "Unverified", so a message that
 * simply hasn't been classified *yet* doesn't read like one that never will be.
 *
 * Process-wide on purpose: the live receiver path and the Messages screen's
 * scan run in different places but feed the same list.
 */
object ClassificationProgress {
    private val _checking = MutableStateFlow<Set<Long>>(emptySet())
    val checking: StateFlow<Set<Long>> = _checking.asStateFlow()

    fun begin(ids: Collection<Long>) {
        if (ids.isNotEmpty()) _checking.update { it + ids }
    }

    fun end(ids: Collection<Long>) {
        if (ids.isNotEmpty()) _checking.update { it - ids.toSet() }
    }
}
