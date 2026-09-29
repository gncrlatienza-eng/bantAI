package com.bantai.ui.screens.main

import android.provider.ContactsContract
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.data.OutgoingSms
import com.bantai.navigation.Screen
import com.bantai.ui.components.rememberSmsSendPermission
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.BorderColor
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.OnAccent
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White
import com.bantai.util.isValidSmsRecipient
import com.bantai.viewmodel.ComposeViewModel
import kotlinx.coroutines.launch

@Composable
fun ComposeScreen(
    navController: NavController,
    initialRecipient: String = "",
    initialBody: String = "",
    viewModel: ComposeViewModel = viewModel(),
) {
    val context = LocalContext.current
    var recipient by remember { mutableStateOf(initialRecipient) }
    var messageBody by remember { mutableStateOf(initialBody) }
    var isSending by remember { mutableStateOf(false) }
    // Set right before navigating away after a successful send, so the draft-save
    // below doesn't re-save text that was just sent (and already had its draft cleared).
    var justSent by remember { mutableStateOf(false) }

    // Leaving this screen any other way (back button, system back gesture) should
    // preserve unsent text as a draft instead of silently discarding it.
    DisposableEffect(Unit) {
        onDispose {
            if (!justSent) viewModel.saveDraft(recipient, messageBody, previousRecipient = initialRecipient)
        }
    }

    // PickContact's returned URI carries its own temporary read grant, so this
    // works without holding READ_CONTACTS at runtime.
    val contactPickerLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.PickContact()) { uri ->
            if (uri == null) return@rememberLauncherForActivityResult
            context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                if (!cursor.moveToFirst()) return@use
                val hasPhoneIndex = cursor.getColumnIndex(ContactsContract.Contacts.HAS_PHONE_NUMBER)
                if (hasPhoneIndex < 0 || cursor.getInt(hasPhoneIndex) <= 0) return@use
                val contactId = cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.Contacts._ID))
                context.contentResolver
                    .query(
                        ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                        arrayOf(ContactsContract.CommonDataKinds.Phone.NUMBER),
                        "${ContactsContract.CommonDataKinds.Phone.CONTACT_ID} = ?",
                        arrayOf(contactId),
                        null,
                    )?.use { phoneCursor ->
                        if (phoneCursor.moveToFirst()) {
                            recipient =
                                phoneCursor.getString(
                                    phoneCursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.NUMBER),
                                )
                        }
                    }
            }
        }

    val withSmsPermission = rememberSmsSendPermission()

    fun sendMessage() {
        val to = recipient.trim().replace(Regex("[\\s\\-()]"), "")
        val body = messageBody.trim()
        if (to.isEmpty()) {
            Toast.makeText(context, "Enter a recipient", Toast.LENGTH_SHORT).show()
            return
        }
        if (!isValidSmsRecipient(to)) {
            Toast.makeText(context, "Enter a valid phone number", Toast.LENGTH_SHORT).show()
            return
        }
        if (body.isEmpty()) {
            Toast.makeText(context, "Enter a message", Toast.LENGTH_SHORT).show()
            return
        }
        // Sending, recording the result and the failure notice all happen in
        // OutgoingSms's own scope: this screen is popped right after, which
        // used to cancel the result update and leave the message "Sending…".
        withSmsPermission {
            OutgoingSms.send(context, to, body)
            viewModel.clearDraft(to)
            justSent = true
            navController.navigate(Screen.Detail.createRoute(to)) {
                popUpTo(Screen.Compose.route) { inclusive = true }
            }
        }
    }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black)
                .statusBarsPadding()
                .imePadding(),
    ) {
        // Top bar
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 4.dp, vertical = 4.dp),
        ) {
            IconButton(
                onClick = { navController.popBackStack() },
                modifier = Modifier.align(Alignment.CenterStart),
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = TextSecondary)
            }
            Text(
                "New Message",
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = TextSize.Headline,
                modifier = Modifier.align(Alignment.Center),
            )
            Box(
                modifier =
                    Modifier
                        .align(Alignment.CenterEnd)
                        .padding(end = 8.dp)
                        .size(36.dp)
                        .background(if (recipient.isNotEmpty() && messageBody.isNotEmpty()) Indigo else Surface, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                if (isSending) {
                    CircularProgressIndicator(color = OnAccent, modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                } else {
                    IconButton(
                        onClick = { sendMessage() },
                        modifier = Modifier.size(36.dp),
                        enabled = !isSending,
                    ) {
                        Icon(
                            Icons.Filled.ArrowUpward,
                            contentDescription = "Send",
                            tint = if (recipient.isNotEmpty() && messageBody.isNotEmpty()) OnAccent else TextSecondary,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                }
            }
        }
        HorizontalDivider(color = Surface)

        // To field
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(Black)
                    .border(width = 1.dp, color = BorderColor)
                    .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("To:", color = TextSecondary, fontSize = TextSize.Footnote)
            BasicTextField(
                value = recipient,
                onValueChange = { recipient = it },
                modifier = Modifier.weight(1f),
                textStyle = TextStyle(color = White, fontSize = TextSize.Body),
                cursorBrush = SolidColor(Indigo),
                singleLine = true,
                keyboardOptions =
                    KeyboardOptions(
                        keyboardType = KeyboardType.Phone,
                        imeAction = ImeAction.Next,
                    ),
                decorationBox = { inner ->
                    if (recipient.isEmpty()) {
                        Text("Phone number", color = TextSecondary, fontSize = TextSize.Body)
                    }
                    inner()
                },
            )
            IconButton(
                onClick = { contactPickerLauncher.launch(null) },
                modifier = Modifier.size(20.dp),
            ) {
                Icon(Icons.Default.PersonAdd, contentDescription = "Add contact", tint = Indigo, modifier = Modifier.size(20.dp))
            }
        }
        HorizontalDivider(color = BorderColor)

        // Message body
        BasicTextField(
            value = messageBody,
            onValueChange = { messageBody = it },
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(16.dp),
            textStyle = TextStyle(color = White, fontSize = TextSize.Body, lineHeight = 22.sp),
            cursorBrush = SolidColor(Indigo),
            decorationBox = { inner ->
                if (messageBody.isEmpty()) {
                    Text("Type a message...", color = TextSecondary, fontSize = TextSize.Body)
                }
                inner()
            },
        )
    }
}
