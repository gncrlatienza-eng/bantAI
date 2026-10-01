package com.bantai.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.bantai.ui.theme.ContactBadge
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White

enum class BadgeType { CONTACT, SAFE, UNVERIFIED, SPAM, UNKNOWN, BLOCKED }

data class MessageItem(
    val sender: String,
    // What the row shows as its title: the contact's name, or the number.
    val title: String = sender,
    val initials: String,
    val avatarColor: Color,
    val preview: String,
    val timestamp: String,
    val badge: BadgeType,
    val isUnread: Boolean = false,
    val isRead: Boolean = true,
)

@Composable
fun StatusBadge(type: BadgeType) {
    when (type) {
        BadgeType.CONTACT -> BadgePill("Contact", ContactBadge, White, null)
        BadgeType.SAFE -> BadgePill("Safe", Safe.copy(alpha = 0.18f), Safe, Safe)
        // Distinct from SAFE on purpose: the on-device heuristic found nothing
        // suspicious, but the backend model never actually checked this message
        // (offline / no token / request failed) -- "nothing found" and "verified
        // clean" must not read the same way to the user.
        BadgeType.UNVERIFIED -> BadgePill("Unverified", Surface, TextSecondary, TextSecondary)
        BadgeType.SPAM -> BadgePill("Spam", Suspicious.copy(alpha = 0.18f), Suspicious, Suspicious)
        BadgeType.UNKNOWN -> BadgePill("Unknown", Surface, TextSecondary, null)
        BadgeType.BLOCKED -> BadgePill("Blocked", Danger.copy(alpha = 0.18f), Danger, Danger)
    }
}

@Composable
private fun BadgePill(
    label: String,
    bg: Color,
    textColor: Color,
    border: Color?,
) {
    Box(
        modifier =
            Modifier
                .background(bg, RoundedCornerShape(100.dp))
                .then(border?.let { Modifier.border(1.dp, it, RoundedCornerShape(100.dp)) } ?: Modifier)
                .padding(horizontal = 8.dp, vertical = 3.dp),
    ) {
        Text(label, color = textColor, fontSize = TextSize.Caption2, fontWeight = FontWeight.Medium)
    }
}
