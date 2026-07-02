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
import androidx.compose.ui.unit.sp
import com.bantai.ui.theme.ContactBadge
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.White

enum class BadgeType { CONTACT, SAFE, SUSPICIOUS, UNKNOWN, BLOCKED }

data class MessageItem(
    val sender: String,
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
        BadgeType.CONTACT    -> BadgePill("Contact",    ContactBadge,       White,         null)
        BadgeType.SAFE       -> BadgePill("Safe",       Color(0xFF1A3A1A),  Safe,          Safe)
        BadgeType.SUSPICIOUS -> BadgePill("Suspicious", Color(0xFF3A1A00),  Suspicious,    Suspicious)
        BadgeType.UNKNOWN    -> BadgePill("Unknown",    Surface,            TextSecondary, null)
        BadgeType.BLOCKED    -> BadgePill("Blocked",    Color(0xFF3A0000),  Danger,        Danger)
    }
}

@Composable
private fun BadgePill(label: String, bg: Color, textColor: Color, border: Color?) {
    Box(
        modifier = Modifier
            .background(bg, RoundedCornerShape(100.dp))
            .then(border?.let { Modifier.border(1.dp, it, RoundedCornerShape(100.dp)) } ?: Modifier)
            .padding(horizontal = 8.dp, vertical = 3.dp),
    ) {
        Text(label, color = textColor, fontSize = 11.sp, fontWeight = FontWeight.Medium)
    }
}
