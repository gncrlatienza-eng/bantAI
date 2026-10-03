package com.bantai.ui.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.DeleteForever
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import com.bantai.R
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White

private const val CONFIRM_WORD = "DELETE"

/** The red row at the bottom of Privacy & data that opens [DeleteAccountDialog]. */
@Composable
internal fun DeleteAccountRow(onClick: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(Surface, RoundedCornerShape(16.dp))
                .clickable(onClick = onClick)
                .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Outlined.DeleteForever, contentDescription = null, tint = Danger, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                stringResource(R.string.privacy_delete_account),
                color = Danger,
                fontWeight = FontWeight.Bold,
                fontSize = TextSize.Subhead,
            )
            Text(
                stringResource(R.string.privacy_delete_account_detail),
                color = TextSecondary,
                fontSize = TextSize.Footnote,
            )
        }
    }
}

/**
 * Permanent account deletion. Separate from Sign out on purpose (Sign out once
 * deleted accounts by mistake): it says plainly what goes, and the red button
 * only works after the user types DELETE, so it can't happen by a stray tap.
 */
@Composable
internal fun DeleteAccountDialog(
    deleting: Boolean,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    var typed by remember { mutableStateOf("") }
    val confirmed = typed.trim().equals(CONFIRM_WORD, ignoreCase = true)
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = SurfaceElevated,
        shape = RoundedCornerShape(20.dp),
        title = {
            Text(stringResource(R.string.delete_account_title), color = White, fontWeight = FontWeight.Bold)
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(stringResource(R.string.delete_account_body), color = TextSecondary, fontSize = TextSize.Subhead)
                OutlinedTextField(
                    value = typed,
                    onValueChange = { typed = it },
                    enabled = !deleting,
                    singleLine = true,
                    label = { Text(stringResource(R.string.delete_account_type_prompt, CONFIRM_WORD)) },
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters),
                    colors =
                        OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Danger,
                            unfocusedBorderColor = Hairline,
                            focusedLabelColor = Danger,
                            focusedTextColor = White,
                            unfocusedTextColor = White,
                            cursorColor = Danger,
                        ),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            TextButton(onClick = onConfirm, enabled = confirmed && !deleting) {
                Text(
                    stringResource(if (deleting) R.string.delete_account_deleting else R.string.delete_account_confirm),
                    color = if (confirmed && !deleting) Danger else TextSecondary,
                    fontWeight = FontWeight.Bold,
                )
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !deleting) {
                Text(stringResource(R.string.action_cancel), color = White)
            }
        },
    )
}
