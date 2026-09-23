package com.bantai.ui.screens.main

import android.provider.ContactsContract
import android.provider.Telephony
import android.util.Log
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
import androidx.compose.material.icons.automirrored.filled.ArrowForward
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
import androidx.compose.runtime.rememberCoroutineScope
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
import com.bantai.data.SmsRepository
import com.bantai.navigation.Screen
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.BorderColor
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.White
import com.bantai.util.NotificationHelper
import com.bantai.util.SmsSender
import com.bantai.util.isValidSmsRecipient
import com.bantai.viewmodel.ComposeViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun ComposeScreen(
    navController: NavController,
    initialRecipient: String = "",
    initialBody: String = "",
    viewModel: ComposeViewModel = viewModel(),
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
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
        isSending = true
        val repo = SmsRepository(context)
        coroutineScope.launch {
            try {
                // Record it as Outbox and jump into the thread immediately — like a
                // normal messaging app, the message shows right away with a "Sending…"
                // state instead of the UI just sitting there through the network round
                // trip. insertOutgoingMessage is a blocking ContentResolver call, so it
                // runs on IO rather than this composable's Main-backed coroutine scope.
                val outboxId = withContext(Dispatchers.IO) { repo.insertOutgoingMessage(to, body) }
                viewModel.clearDraft(to)
                justSent = true
                isSending = false
                navController.navigate(Screen.Detail.createRoute(to)) {
                    popUpTo(Screen.Compose.route) { inclusive = true }
                }
                SmsSender.send(context, to, body) { success, error ->
                    if (outboxId != null) {
                        coroutineScope.launch(Dispatchers.IO) {
                            repo.updateMessageType(
                                outboxId,
                                if (success) Telephony.Sms.MESSAGE_TYPE_SENT else Telephony.Sms.MESSAGE_TYPE_FAILED,
                            )
                        }
                    }
                    if (!success) {
                        Log.w("ComposeScreen", "Send failed: $error")
                        // Real-time, not just the in-thread indicator — the result can
                        // resolve well after the user has moved past this screen.
                        NotificationHelper.sendFailedMessageNotification(context, to, body, NotificationHelper.notifIdFor(to))
                    }
                }
            } catch (e: Exception) {
                Log.e("ComposeScreen", "Failed to send message", e)
                Toast.makeText(context, "Failed to send message", Toast.LENGTH_SHORT).show()
                isSending = false
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
                fontSize = 17.sp,
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
                    CircularProgressIndicator(color = White, modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                } else {
                    IconButton(
                        onClick = { sendMessage() },
                        modifier = Modifier.size(36.dp),
                        enabled = !isSending,
                    ) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowForward,
                            contentDescription = "Send",
                            tint = if (recipient.isNotEmpty() && messageBody.isNotEmpty()) White else TextSecondary,
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
            Text("To:", color = TextSecondary, fontSize = 13.sp)
            BasicTextField(
                value = recipient,
                onValueChange = { recipient = it },
                modifier = Modifier.weight(1f),
                textStyle = TextStyle(color = White, fontSize = 15.sp),
                cursorBrush = SolidColor(Indigo),
                singleLine = true,
                keyboardOptions =
                    KeyboardOptions(
                        keyboardType = KeyboardType.Phone,
                        imeAction = ImeAction.Next,
                    ),
                decorationBox = { inner ->
                    if (recipient.isEmpty()) {
                        Text("Phone number", color = TextSecondary, fontSize = 15.sp)
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
            textStyle = TextStyle(color = White, fontSize = 15.sp, lineHeight = 22.sp),
            cursorBrush = SolidColor(Indigo),
            decorationBox = { inner ->
                if (messageBody.isEmpty()) {
                    Text("Type a message...", color = TextSecondary, fontSize = 15.sp)
                }
                inner()
            },
        )
    }
}
