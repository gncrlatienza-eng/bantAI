package com.bantai.ui.screens.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import com.bantai.R
import com.bantai.ui.components.BantaiAlertDialog
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White

private const val CONFIRM_WORD = "DELETE"

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
    BantaiAlertDialog(
        onDismissRequest = onDismiss,
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
                    shape = RoundedCornerShape(12.dp),
                    colors =
                        OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Danger,
                            unfocusedBorderColor = Color.Transparent,
                            focusedContainerColor = Black,
                            unfocusedContainerColor = Black,
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
