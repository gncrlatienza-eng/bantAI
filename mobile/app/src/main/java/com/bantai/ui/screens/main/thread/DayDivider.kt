package com.bantai.ui.screens.main.thread

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize

// "Today", "Yesterday", "Monday", "Sep 12" between days in a conversation.
@Composable
internal fun DayDivider(label: String) {
    Text(
        label,
        color = TextSecondary,
        fontSize = TextSize.Footnote,
        fontWeight = FontWeight.Medium,
        textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 4.dp),
    )
}
