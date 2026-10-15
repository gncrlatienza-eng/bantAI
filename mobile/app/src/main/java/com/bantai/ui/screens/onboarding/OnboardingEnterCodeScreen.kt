package com.bantai.ui.screens.onboarding

import android.app.Activity
import android.content.ContextWrapper
import android.view.WindowManager
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.dropUnlessResumed
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.navigation.Screen
import com.bantai.ui.components.OnboardingHeader
import com.bantai.ui.components.PrimaryButton
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White
import com.bantai.viewmodel.OnboardingViewModel
import kotlinx.coroutines.delay

private const val COUNTDOWN_TICK_MS = 1000L
private const val MS_PER_SECOND = 1000L
private const val OTP_LENGTH = 6

@Composable
fun OnboardingEnterCodeScreen(
    navController: NavController,
    viewModel: OnboardingViewModel,
) {
    val state by viewModel.state.collectAsState()
    var code by remember { mutableStateOf("") }
    val focusRequester = remember { FocusRequester() }

    // Fires after the backend accepts the typed OTP and the JWT is persisted.
    // This phone already finished setup (a sign-out, or a 401 from
    // NavGraph's AuthEventBus.sessionExpired handler): straight back into the
    // app, via the name step only when the account has no saved name yet.
    LaunchedEffect(Unit) {
        viewModel.onboardingAuthComplete.collect {
            if (viewModel.userData.value.onboardingComplete) {
                val needsName = viewModel.firstName.value.isBlank()
                val route = if (needsName) Screen.OnboardingProfile.route else Screen.Main.route
                navController.navigate(route) {
                    popUpTo(0) { inclusive = true }
                }
            } else {
                // Signed in now, so Back shouldn't lead to the phone/code screens again.
                navController.navigate(Screen.OnboardingDefaultSms.route) {
                    popUpTo(0) { inclusive = true }
                }
            }
        }
    }

    // Ticks once a second purely to re-derive the resend/lockout countdowns below
    // from state.resendAvailableAtMs / verifyLockedUntilMs -- those timestamps are
    // the source of truth, this is just what forces the UI to recompute against them.
    var nowMs by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(COUNTDOWN_TICK_MS)
            nowMs = System.currentTimeMillis()
        }
    }
    val resendRemainingSec = ((state.resendAvailableAtMs - nowMs) / MS_PER_SECOND).coerceAtLeast(0)
    val verifyLockedRemainingSec = ((state.verifyLockedUntilMs - nowMs) / MS_PER_SECOND).coerceAtLeast(0)

    LaunchedEffect(Unit) { focusRequester.requestFocus() }

    // The one screen showing BantAI's own sign-in code: no screenshots, screen
    // recording, or Recents thumbnail while it's open (the rest of the app allows them).
    val context = LocalContext.current
    val window =
        remember(context) {
            generateSequence(context) { (it as? ContextWrapper)?.baseContext }
                .filterIsInstance<Activity>()
                .firstOrNull()
                ?.window
        }
    DisposableEffect(window) {
        window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        onDispose { window?.clearFlags(WindowManager.LayoutParams.FLAG_SECURE) }
    }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black)
                .statusBarsPadding()
                .navigationBarsPadding()
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp),
    ) {
        Spacer(Modifier.height(16.dp))
        IconButton(onClick = dropUnlessResumed { navController.popBackStack() }) {
            Icon(
                Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = stringResource(R.string.action_back),
                tint = White,
            )
        }
        Spacer(Modifier.height(16.dp))

        OnboardingHeader(
            eyebrow = stringResource(R.string.onboarding_enter_code_step_3_of_5),
            title = stringResource(R.string.onboarding_enter_code_enter_the_code),
            subtitle = stringResource(R.string.onboarding_code_sent_to, state.phoneNumber),
        )
        Spacer(Modifier.height(32.dp))

        OtpField(
            code = code,
            focusRequester = focusRequester,
            onCodeChange = { new ->
                code = otpFrom(code, new)
                viewModel.updateOtpCode(code)
            },
        )

        if (state.errorMessage != null) {
            Spacer(Modifier.height(16.dp))
            Text(state.errorMessage ?: "", fontSize = TextSize.Caption, color = Danger)
        }

        Spacer(Modifier.height(24.dp))
        Row {
            Text(
                stringResource(R.string.onboarding_enter_code_didn_t_get_it),
                color = TextSecondary,
                fontSize = TextSize.Body,
            )
            if (resendRemainingSec > 0) {
                Text(
                    stringResource(R.string.onboarding_resend_in, resendRemainingSec),
                    color = TextSecondary,
                    fontSize = TextSize.Body,
                )
            } else {
                Text(
                    stringResource(R.string.onboarding_enter_code_resend_code),
                    color = Indigo,
                    fontSize = TextSize.Body,
                    modifier =
                        Modifier.clickable {
                            viewModel.resendVerificationCode()
                        },
                )
            }
        }

        Spacer(Modifier.weight(1f))

        PrimaryButton(
            text =
                if (verifyLockedRemainingSec > 0) {
                    stringResource(R.string.onboarding_try_again_in, verifyLockedRemainingSec)
                } else {
                    stringResource(R.string.onboarding_verify)
                },
            onClick = { viewModel.verifyCode() },
            enabled = !state.isLoading && verifyLockedRemainingSec == 0L,
            isLoading = state.isLoading,
        )
        Spacer(Modifier.height(24.dp))
    }
}

// A paste (e.g. the whole "Your BantAI code is 123456" from the notification)
// takes the 6-digit run out of what was inserted; typing and backspace just
// keep the digits.
private fun otpFrom(
    old: String,
    new: String,
): String {
    val inserted = if (new.length - old.length > 1 && new.startsWith(old)) new.substring(old.length) else null
    val source = inserted?.let { Regex("\\d{$OTP_LENGTH}").find(it)?.value } ?: new
    return source.filter(Char::isDigit).take(OTP_LENGTH)
}

// One real text field drawn as six boxes: paste, long-press, and backspace
// behave like any field instead of hopping focus between six separate ones.
@Composable
private fun OtpField(
    code: String,
    focusRequester: FocusRequester,
    onCodeChange: (String) -> Unit,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()

    BasicTextField(
        // Cursor pinned to the end so input always fills the next box.
        value = TextFieldValue(code, TextRange(code.length)),
        onValueChange = { onCodeChange(it.text) },
        modifier = Modifier.fillMaxWidth().focusRequester(focusRequester),
        textStyle = TextStyle(color = Color.Transparent),
        cursorBrush = SolidColor(Color.Transparent),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
        singleLine = true,
        interactionSource = interactionSource,
        decorationBox = { innerTextField ->
            Box {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    repeat(OTP_LENGTH) { i ->
                        val active = isFocused && i == code.length.coerceAtMost(OTP_LENGTH - 1)
                        Box(
                            modifier =
                                Modifier
                                    .weight(1f)
                                    .heightIn(min = 52.dp)
                                    .background(SurfaceElevated, RoundedCornerShape(12.dp))
                                    .then(
                                        if (active) {
                                            Modifier.border(
                                                width = 1.dp,
                                                color = Indigo.copy(alpha = 0.6f),
                                                shape = RoundedCornerShape(12.dp),
                                            )
                                        } else {
                                            Modifier
                                        },
                                    ),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                code.getOrNull(i)?.toString().orEmpty(),
                                color = White,
                                fontSize = TextSize.Title,
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center,
                            )
                        }
                    }
                }
                Box(Modifier.matchParentSize()) { innerTextField() }
            }
        },
    )
}
