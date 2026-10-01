package com.bantai.ui.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.ui.components.LocalBottomBarClearance
import com.bantai.ui.theme.*
import com.bantai.ui.theme.OnAccent
import com.bantai.ui.theme.OnIndigo
import com.bantai.ui.theme.TextTertiary
import com.bantai.util.NAME_MAX_LENGTH
import com.bantai.viewmodel.SettingsViewModel

// Longest PH number with separators, e.g. "+63 917 123 4567".
private const val MY_NUMBER_MAX_LENGTH = 16

@Suppress("LongMethod", "CyclomaticComplexMethod") // the whole form; one branch per field's error/hint state
@Composable
fun EditProfileScreen(
    navController: NavController,
    viewModel: SettingsViewModel,
) {
    val firstName by viewModel.editFirstName.collectAsState()
    val lastName by viewModel.editLastName.collectAsState()
    val myNumber by viewModel.editMyNumber.collectAsState()
    val myNumberError by viewModel.myNumberError.collectAsState()
    val avatarColor by viewModel.editAvatarColor.collectAsState()
    val firstNameError by viewModel.firstNameError.collectAsState()
    val lastNameError by viewModel.lastNameError.collectAsState()
    val syncError by viewModel.profileSyncError.collectAsState()
    val isSaving by viewModel.profileSaving.collectAsState()

    var showSaved by remember { mutableStateOf(false) }

    val parsedColor =
        remember(avatarColor) {
            try {
                Color(android.graphics.Color.parseColor(avatarColor))
            } catch (e: Exception) {
                Color(0xFFFF6B35)
            }
        }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 4.dp, vertical = 4.dp),
        ) {
            IconButton(
                onClick = { navController.popBackStack() },
                modifier = Modifier.align(Alignment.CenterStart),
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.action_back),
                    tint = White,
                )
            }
            Text(
                stringResource(R.string.edit_profile_edit_profile),
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = TextSize.Headline,
                modifier = Modifier.align(Alignment.Center),
            )
        }
        HorizontalDivider(color = Surface)

        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .imePadding()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp),
        ) {
            Spacer(Modifier.height(20.dp))

            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        modifier =
                            Modifier
                                .size(80.dp)
                                .background(parsedColor, CircleShape)
                                .clickable { viewModel.cycleAvatarColor() },
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(viewModel.getInitials(), color = OnAccent, fontWeight = FontWeight.Bold, fontSize = 28.sp)
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        stringResource(R.string.edit_profile_tap_to_change_color),
                        color = TextSecondary,
                        fontSize = TextSize.Caption2,
                    )
                }
            }

            Spacer(Modifier.height(24.dp))

            Text(
                stringResource(R.string.onboarding_profile_first_name),
                color = TextSecondary,
                fontSize = TextSize.Caption,
            )
            Spacer(Modifier.height(6.dp))
            OutlinedTextField(
                value = firstName,
                onValueChange = { if (it.length <= NAME_MAX_LENGTH) viewModel.updateEditFirstName(it) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                isError = firstNameError != null,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
                colors =
                    OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Indigo,
                        unfocusedBorderColor = BorderColor,
                        focusedTextColor = White,
                        unfocusedTextColor = White,
                        errorBorderColor = Danger,
                        cursorColor = Indigo,
                    ),
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                if (firstNameError != null) {
                    Text(
                        firstNameError ?: "",
                        color = Danger,
                        fontSize = TextSize.Footnote,
                        modifier = Modifier.weight(1f),
                    )
                } else {
                    Spacer(Modifier.weight(1f))
                }
                Text("${firstName.length}/$NAME_MAX_LENGTH", color = TextSecondary, fontSize = TextSize.Caption2)
            }

            Spacer(Modifier.height(16.dp))

            Text(
                stringResource(R.string.onboarding_profile_last_name_optional),
                color = TextSecondary,
                fontSize = TextSize.Caption,
            )
            Spacer(Modifier.height(6.dp))
            OutlinedTextField(
                value = lastName,
                onValueChange = { if (it.length <= NAME_MAX_LENGTH) viewModel.updateEditLastName(it) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                isError = lastNameError != null,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
                colors =
                    OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Indigo,
                        unfocusedBorderColor = BorderColor,
                        focusedTextColor = White,
                        unfocusedTextColor = White,
                        errorBorderColor = Danger,
                        cursorColor = Indigo,
                    ),
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                if (lastNameError != null) {
                    Text(
                        lastNameError ?: "",
                        color = Danger,
                        fontSize = TextSize.Footnote,
                        modifier = Modifier.weight(1f),
                    )
                } else {
                    Spacer(Modifier.weight(1f))
                }
                Text("${lastName.length}/$NAME_MAX_LENGTH", color = TextSecondary, fontSize = TextSize.Caption2)
            }

            Spacer(Modifier.height(16.dp))
            Text(
                stringResource(R.string.edit_profile_my_number),
                color = TextSecondary,
                fontSize = TextSize.Caption,
            )
            Spacer(Modifier.height(6.dp))
            OutlinedTextField(
                value = myNumber,
                onValueChange = { if (it.length <= MY_NUMBER_MAX_LENGTH) viewModel.updateEditMyNumber(it) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                isError = myNumberError != null,
                placeholder = { Text("09171234567", color = TextTertiary) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                colors =
                    OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Indigo,
                        unfocusedBorderColor = BorderColor,
                        focusedTextColor = White,
                        unfocusedTextColor = White,
                        errorBorderColor = Danger,
                        cursorColor = Indigo,
                    ),
            )
            Text(
                myNumberError ?: stringResource(R.string.edit_profile_my_number_hint),
                color = if (myNumberError != null) Danger else TextSecondary,
                fontSize = TextSize.Footnote,
                modifier = Modifier.padding(top = 4.dp),
            )

            Spacer(Modifier.height(32.dp))

            if (syncError != null) {
                Text(
                    syncError ?: "",
                    color = Danger,
                    fontSize = TextSize.Footnote,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(bottom = 8.dp),
                    textAlign = TextAlign.Center,
                )
            } else if (showSaved) {
                Text(
                    stringResource(R.string.edit_profile_profile_saved),
                    color = Safe,
                    fontSize = TextSize.Footnote,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(bottom = 8.dp),
                    textAlign = TextAlign.Center,
                )
            }

            Button(
                onClick = {
                    viewModel.saveProfile {
                        showSaved = true
                    }
                },
                enabled = !isSaving,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        // Bottom clearance matches the floating tab bar's footprint
                        // (see MainScreen) -- this screen now renders behind it.
                        .padding(bottom = LocalBottomBarClearance.current)
                        .heightIn(min = 52.dp),
                colors =
                    ButtonDefaults.buttonColors(
                        containerColor = Indigo,
                        disabledContainerColor = ContactBadge,
                        contentColor = OnIndigo,
                        disabledContentColor = TextSecondary,
                    ),
                shape = RoundedCornerShape(12.dp),
            ) {
                Text(
                    stringResource(if (isSaving) R.string.edit_profile_saving else R.string.edit_profile_save_changes),
                    fontWeight = FontWeight.Bold,
                    fontSize = TextSize.Body,
                )
            }
        }
    }
}
