package com.bantai.ui.components

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.bantai.R
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White

/**
 * The one confirmation before a sender is unblocked, from an alert or from
 * Settings -> Blocked numbers. Unblock is red and Cancel is the bold, safe
 * choice, so a likely scammer isn't let back in by a reflexive tap.
 */
@Composable
fun UnblockConfirmDialog(
    sender: String,
    detail: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = SurfaceElevated,
        shape = RoundedCornerShape(20.dp),
        title = {
            Text(stringResource(R.string.unblock_confirm_title, sender), color = White, fontWeight = FontWeight.Bold)
        },
        text = { Text(detail, color = TextSecondary, fontSize = TextSize.Subhead) },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(stringResource(R.string.blocked_numbers_unblock), color = Danger)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.action_cancel), color = White, fontWeight = FontWeight.Bold)
            }
        },
    )
}
