package com.bantai.ui.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.ui.theme.*
import com.bantai.viewmodel.SettingsViewModel

@Composable
fun EditProfileScreen(
    navController: NavController,
    viewModel: SettingsViewModel,
) {
    val firstName by viewModel.editFirstName.collectAsState()
    val lastName by viewModel.editLastName.collectAsState()
    val avatarColor by viewModel.editAvatarColor.collectAsState()

    var firstNameError by remember { mutableStateOf("") }
    var showSaved by remember { mutableStateOf(false) }

    val parsedColor = remember(avatarColor) {
        try { Color(android.graphics.Color.parseColor(avatarColor)) }
        catch (e: Exception) { Color(0xFFFF6B35) }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Black)
            .padding(horizontal = 20.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 16.dp, bottom = 24.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                Icons.Default.ArrowBack,
                contentDescription = "Back",
                tint = White,
                modifier = Modifier
                    .size(24.dp)
                    .clickable { navController.popBackStack() },
            )
            Spacer(Modifier.width(16.dp))
            Text("Edit Profile", color = White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
        }

        Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .background(parsedColor, CircleShape)
                        .clickable { viewModel.cycleAvatarColor() },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(viewModel.getInitials(), color = White, fontWeight = FontWeight.Bold, fontSize = 28.sp)
                }
                Spacer(Modifier.height(8.dp))
                Text("Tap to change color", color = TextSecondary, fontSize = 11.sp)
            }
        }

        Spacer(Modifier.height(24.dp))

        Text("First name", color = TextSecondary, fontSize = 12.sp)
        Spacer(Modifier.height(6.dp))
        OutlinedTextField(
            value = firstName,
            onValueChange = {
                if (it.length <= 30) {
                    viewModel.updateEditFirstName(it)
                    firstNameError = ""
                }
            },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            isError = firstNameError.isNotEmpty(),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Color(0xFF5B4FE8),
                unfocusedBorderColor = Color(0xFF2A2A2A),
                focusedTextColor = White,
                unfocusedTextColor = White,
                errorBorderColor = Color(0xFFFF3B30),
                cursorColor = Color(0xFF5B4FE8),
            ),
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            if (firstNameError.isNotEmpty()) {
                Text(firstNameError, color = Color(0xFFFF3B30), fontSize = 11.sp)
            } else {
                Spacer(Modifier.weight(1f))
            }
            Text("${firstName.length}/30", color = TextSecondary, fontSize = 11.sp)
        }

        Spacer(Modifier.height(16.dp))

        Text("Last name (optional)", color = TextSecondary, fontSize = 12.sp)
        Spacer(Modifier.height(6.dp))
        OutlinedTextField(
            value = lastName,
            onValueChange = { if (it.length <= 30) viewModel.updateEditLastName(it) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Color(0xFF5B4FE8),
                unfocusedBorderColor = Color(0xFF2A2A2A),
                focusedTextColor = White,
                unfocusedTextColor = White,
                cursorColor = Color(0xFF5B4FE8),
            ),
        )
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            Text("${lastName.length}/30", color = TextSecondary, fontSize = 11.sp)
        }

        Spacer(Modifier.weight(1f))

        if (showSaved) {
            Text(
                "Profile saved!",
                color = Color(0xFF34C759),
                fontSize = 13.sp,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp),
                textAlign = TextAlign.Center,
            )
        }

        Button(
            onClick = {
                val trimmed = firstName.trim()
                if (trimmed.isEmpty()) {
                    firstNameError = "First name is required"
                    return@Button
                }
                if (!trimmed.all { it.isLetter() || it.isWhitespace() }) {
                    firstNameError = "Name should only contain letters"
                    return@Button
                }
                viewModel.saveProfile {
                    showSaved = true
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 24.dp)
                .height(52.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF5B4FE8)),
            shape = RoundedCornerShape(12.dp),
        ) {
            Text("Save changes", color = White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
        }
    }
}
