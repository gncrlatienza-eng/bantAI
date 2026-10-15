package com.bantai.ui.screens.onboarding

import android.app.Activity
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Message
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.bantai.R
import com.bantai.ui.components.BantAILogo
import com.bantai.ui.components.FeatureListRow
import com.bantai.ui.components.GroupedCard
import com.bantai.ui.components.GroupedDivider
import com.bantai.ui.components.OnboardingHeader
import com.bantai.ui.components.PrimaryButton
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.util.BlockHelper

private const val SUPPRESSED_PROMPT_MS = 500L

// The role request on Android 10+, the system's "change default" prompt before.
private fun defaultSmsRequest(context: Context): Intent {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val rm = context.getSystemService(RoleManager::class.java)
        if (rm != null && rm.isRoleAvailable(RoleManager.ROLE_SMS)) {
            return rm.createRequestRoleIntent(RoleManager.ROLE_SMS)
        }
    }
    // Android 8-9 have no RoleManager: the system's "change default SMS app" prompt.
    return BlockHelper.defaultSmsAppIntent(context)
}

/**
 * Shown over the whole app while BantAI isn't the default SMS app. Without
 * that role new texts never reach BantAI (SMS_DELIVER only goes to the
 * default app), so its lists would look protected while nothing new is being
 * checked. Messages stay hidden until the user sets it; NavGraph re-checks on
 * every resume, so switching default away brings this back.
 */
@Composable
@Suppress("LongMethod") // one full-screen layout
fun DefaultSmsGateScreen(
    onRoleResult: () -> Unit,
    onSignOut: () -> Unit,
) {
    val context = LocalContext.current
    var launchedAt by remember { mutableLongStateOf(0L) }
    val launcher =
        rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            // After two denials Android stops showing the role prompt and cancels
            // at once, so the button would silently do nothing. Answered that
            // fast, nobody saw a prompt: open the system's default-apps page.
            val instant = SystemClock.elapsedRealtime() - launchedAt < SUPPRESSED_PROMPT_MS
            if (result.resultCode != Activity.RESULT_OK && instant && !BlockHelper.isDefaultSmsApp(context)) {
                runCatching { context.startActivity(Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS)) }
            }
            onRoleResult()
        }
    // Nothing behind this screen to go back to.
    BackHandler {}

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black)
                // Swallows touches so the app underneath can't be reached.
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp),
    ) {
        // Scrolls on a small screen or at a large font size; the buttons stay pinned below.
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
            Spacer(Modifier.height(48.dp))
            BantAILogo(size = 56.dp)
            Spacer(Modifier.height(20.dp))
            OnboardingHeader(
                eyebrow = stringResource(R.string.gate_eyebrow),
                title = stringResource(R.string.gate_title),
                subtitle = stringResource(R.string.gate_subtitle),
            )
            Spacer(Modifier.height(28.dp))
            GroupedCard {
                FeatureListRow(
                    icon = Icons.Filled.Shield,
                    title = stringResource(R.string.gate_point_check_title),
                    subtitle = stringResource(R.string.gate_point_check_detail),
                )
                GroupedDivider()
                FeatureListRow(
                    icon = Icons.Filled.Block,
                    title = stringResource(R.string.gate_point_block_title),
                    subtitle = stringResource(R.string.gate_point_block_detail),
                )
                GroupedDivider()
                FeatureListRow(
                    icon = Icons.AutoMirrored.Filled.Message,
                    title = stringResource(R.string.gate_point_inbox_title),
                    subtitle = stringResource(R.string.gate_point_inbox_detail),
                )
            }
            Spacer(Modifier.height(16.dp))
        }
        PrimaryButton(
            text = stringResource(R.string.gate_button),
            onClick = {
                launchedAt = SystemClock.elapsedRealtime()
                runCatching { launcher.launch(defaultSmsRequest(context)) }
            },
        )
        Spacer(Modifier.height(8.dp))
        Box(
            modifier = Modifier.fillMaxWidth().heightIn(min = 44.dp).clickable(onClick = onSignOut),
            contentAlignment = Alignment.Center,
        ) {
            Text(stringResource(R.string.gate_sign_out), color = TextSecondary, fontSize = TextSize.Subhead)
        }
        Spacer(Modifier.height(12.dp))
    }
}
