package com.bantai.ui.components

import androidx.compose.ui.graphics.Color
import com.bantai.ui.theme.AvatarGreen
import com.bantai.ui.theme.AvatarPink
import com.bantai.ui.theme.AvatarPurple
import com.bantai.ui.theme.AvatarRed
import com.bantai.ui.theme.AvatarTeal
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Suspicious

fun getAvatarColor(sender: String): Color {
    val colors =
        listOf(
            AvatarRed,
            AvatarTeal,
            AvatarPink,
            AvatarGreen,
            Suspicious,
            AvatarPurple,
            Indigo,
            Color(0xFFFF6B35),
        )
    // abs() must wrap the modulo, not the raw hashCode -- kotlin.math.abs(Int.MIN_VALUE)
    // overflows back to Int.MIN_VALUE (two's complement has no positive counterpart),
    // which would throw ArrayIndexOutOfBoundsException on the list access below. The
    // remainder is always within (-colors.size, colors.size), far from that edge case.
    return colors[kotlin.math.abs(sender.hashCode() % colors.size)]
}

fun getInitialsFromSender(sender: String): String =
    if (sender.isBlank()) {
        "?"
    } else if (sender.startsWith("+")) {
        "+9"
    } else {
        val words = sender.trim().split(" ")
        when {
            words.size >= 2 -> "${words[0].firstOrNull()?.uppercase() ?: ""}${words[1].firstOrNull()?.uppercase() ?: ""}"
            words.size == 1 -> words[0].take(2).uppercase()
            else -> "?"
        }
    }

fun getRelativeTime(timestamp: Long): String {
    val diff = (System.currentTimeMillis() - timestamp).coerceAtLeast(0L)
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
