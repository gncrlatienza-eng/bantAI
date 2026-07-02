package com.bantai.ui.screens.main

import android.os.Build
import android.telephony.SmsManager
import android.util.Log
import android.widget.Toast
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
import androidx.navigation.NavController
import com.bantai.navigation.Screen
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.BorderColor
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.White

@Composable
fun ComposeScreen(navController: NavController, initialRecipient: String = "") {
    val context = LocalContext.current
    var recipient by remember { mutableStateOf(initialRecipient) }
    var messageBody by remember { mutableStateOf("") }
    var isSending by remember { mutableStateOf(false) }

    // Accept E.164 (+[1-15 digits]) or local all-digit numbers (7-15 digits).
    // Rejects alphanumeric sender IDs (which are receive-only) and short codes
    // below 7 digits to prevent accidental sends to premium-rate services.
    fun isValidRecipient(number: String): Boolean {
        if (number.startsWith("+")) {
            val digits = number.drop(1)
            return digits.all { it.isDigit() } && digits.length in 7..15
        }
        return number.all { it.isDigit() } && number.length in 7..15
    }

    fun sendMessage() {
        val to = recipient.trim()
        val body = messageBody.trim()
        if (to.isEmpty()) {
            Toast.makeText(context, "Enter a recipient", Toast.LENGTH_SHORT).show()
            return
        }
        if (!isValidRecipient(to)) {
            Toast.makeText(context, "Enter a valid phone number", Toast.LENGTH_SHORT).show()
            return
        }
        if (body.isEmpty()) {
            Toast.makeText(context, "Enter a message", Toast.LENGTH_SHORT).show()
            return
        }
        isSending = true
        try {
            @Suppress("DEPRECATION")
            val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                context.getSystemService(SmsManager::class.java)
                    ?: SmsManager.getDefault()
            } else {
                SmsManager.getDefault()
            }
            val parts = smsManager.divideMessage(body)
            if (parts.size == 1) {
                smsManager.sendTextMessage(to, null, body, null, null)
            } else {
                smsManager.sendMultipartTextMessage(to, null, parts, null, null)
            }
            isSending = false
            navController.navigate(Screen.Detail.createRoute(to)) {
                popUpTo(Screen.Compose.route) { inclusive = true }
            }
        } catch (e: Exception) {
            Log.e("ComposeScreen", "Failed to send message", e)
            Toast.makeText(context, "Failed to send message", Toast.LENGTH_SHORT).show()
            isSending = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Black)
            .statusBarsPadding()
            .imePadding(),
    ) {
        // Top bar
        Box(
            modifier = Modifier
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
                modifier = Modifier
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
            modifier = Modifier
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
                keyboardOptions = KeyboardOptions(
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
            Icon(Icons.Default.PersonAdd, contentDescription = "Add contact", tint = Indigo, modifier = Modifier.size(20.dp))
        }
        HorizontalDivider(color = BorderColor)

        // Message body
        BasicTextField(
            value = messageBody,
            onValueChange = { messageBody = it },
            modifier = Modifier
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
