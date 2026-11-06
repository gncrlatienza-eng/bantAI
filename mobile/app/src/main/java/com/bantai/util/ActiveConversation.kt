package com.bantai.util

import com.bantai.data.model.normalizeSenderKey

/**
 * The conversation currently on screen (null when none), so an incoming text
 * for it is marked read and doesn't also buzz a notification -- it used to do
 * both, and the thread's messages stayed unread while you were reading them.
 */
object ActiveConversation {
    @Volatile private var key: String? = null

    fun opened(sender: String) {
        key = normalizeSenderKey(sender)
    }

    fun closed(sender: String) {
        if (key == normalizeSenderKey(sender)) key = null
    }

    fun isOpen(sender: String): Boolean = key != null && key == normalizeSenderKey(sender)
}
