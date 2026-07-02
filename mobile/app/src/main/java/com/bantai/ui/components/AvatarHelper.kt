package com.bantai.ui.components

import androidx.compose.ui.graphics.Color

fun getAvatarColor(sender: String): Color {
    val colors = listOf(
        Color(0xFFFF4444),
        Color(0xFF00BCD4),
        Color(0xFFE91E8C),
        Color(0xFF4CAF50),
        Color(0xFFFF9500),
        Color(0xFF9C27B0),
        Color(0xFF5B4FE8),
        Color(0xFFFF6B35),
    )
    return colors[kotlin.math.abs(sender.hashCode()) % colors.size]
}

fun getInitialsFromSender(sender: String): String {
    return if (sender.startsWith("+")) {
        "+9"
    } else {
        val words = sender.trim().split(" ")
        when {
            words.size >= 2 -> "${words[0].firstOrNull()?.uppercase() ?: ""}${words[1].firstOrNull()?.uppercase() ?: ""}"
            words.size == 1 -> sender.take(2).uppercase()
            else -> "?"
        }
    }
}

fun getRelativeTime(timestamp: Long): String {
    val diff = System.currentTimeMillis() - timestamp
    val minutes = diff / 60000
    val hours = diff / 3600000
    val days = diff / 86400000
    return when {
        minutes < 60 -> "${minutes}m"
        hours < 24 -> "${hours}h"
        days < 7 -> "${days}d"
        else -> "${days / 7}w"
    }
}
