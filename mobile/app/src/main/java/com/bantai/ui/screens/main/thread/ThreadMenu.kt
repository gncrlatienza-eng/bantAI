package com.bantai.ui.screens.main.thread

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Block
import androidx.compose.material.icons.outlined.MoreHoriz
import androidx.compose.material.icons.outlined.ReportGmailerrorred
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.bantai.R
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White

// Report and Block live behind one "..." menu, iOS-style, rather than a
// colored flag in the title bar. [onBlock] is null for a trusted sender name:
// it can still be reported, but blocking it would cut off the real company.
@Composable
internal fun ThreadMenu(
    enabled: Boolean,
    onReport: () -> Unit,
    onBlock: (() -> Unit)?,
) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        IconButton(onClick = { expanded = true }, enabled = enabled) {
            Icon(
                Icons.Outlined.MoreHoriz,
                contentDescription = stringResource(R.string.message_detail_more),
                tint = if (enabled) White else TextTertiary,
            )
        }
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            containerColor = SurfaceElevated,
            shape = RoundedCornerShape(14.dp),
        ) {
            DropdownMenuItem(
                text = {
                    Text(
                        stringResource(R.string.message_detail_report_message),
                        color = White,
                        fontSize = TextSize.Body,
                    )
                },
                trailingIcon = {
                    Icon(
                        Icons.Outlined.ReportGmailerrorred,
                        contentDescription = null,
                        tint = White,
                        modifier = Modifier.size(20.dp),
                    )
                },
                onClick = {
                    expanded = false
                    onReport()
                },
            )
            if (onBlock == null) return@DropdownMenu
            HorizontalDivider(color = Hairline, thickness = 0.5.dp)
            DropdownMenuItem(
                text = { Text(stringResource(R.string.alert_block_sender), color = Danger, fontSize = TextSize.Body) },
                trailingIcon = {
                    Icon(
                        Icons.Outlined.Block,
                        contentDescription = null,
                        tint = Danger,
                        modifier = Modifier.size(20.dp),
                    )
                },
                onClick = {
                    expanded = false
                    onBlock()
                },
            )
        }
    }
}
