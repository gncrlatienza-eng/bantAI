package com.bantai.ui.screens.main

import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.CloudQueue
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.R
import com.bantai.navigation.Screen
import com.bantai.ui.components.ListSkeleton
import com.bantai.ui.components.LocalBottomBarClearance
import com.bantai.ui.components.UnblockConfirmDialog
import com.bantai.ui.theme.*
import com.bantai.util.BlockHelper
import com.bantai.viewmodel.BlockedNumbersViewModel

@Composable
fun BlockedNumbersScreen(
    navController: NavController,
    viewModel: BlockedNumbersViewModel = viewModel(),
) {
    val context = LocalContext.current
    val blockedNumbers by viewModel.blockedNumbers.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val isDefaultSmsApp by viewModel.isDefaultSmsApp.collectAsState()
    val syncError by viewModel.syncError.collectAsState()
    var numberToUnblock by remember { mutableStateOf<BlockHelper.BlockedEntry?>(null) }
    val serverOnlyCount = blockedNumbers.count { !it.onDevice }

    // Coming back from the system "default SMS app" prompt: if BantAI got the
    // role, move the server-only blocks onto the phone right away.
    val defaultSmsLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            if (BlockHelper.isDefaultSmsApp(context)) viewModel.blockOnDevice() else viewModel.loadBlockedNumbers()
        }

    LaunchedEffect(syncError) {
        if (syncError != null) {
            Toast.makeText(context, syncError, Toast.LENGTH_LONG).show()
            viewModel.clearSyncError()
        }
    }

    numberToUnblock?.let { entry ->
        UnblockConfirmDialog(
            sender = entry.number,
            detail = stringResource(R.string.blocked_numbers_unblock_detail, entry.number),
            onConfirm = {
                viewModel.unblockNumber(entry)
                numberToUnblock = null
            },
            onDismiss = { numberToUnblock = null },
        )
    }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black),
    ) {
        // Top bar
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
                stringResource(R.string.blocked_numbers_blocked_numbers),
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = TextSize.Headline,
                modifier = Modifier.align(Alignment.Center),
            )
        }
        HorizontalDivider(color = Surface)

        if (isLoading) {
            ListSkeleton(rows = 6)
        } else if (blockedNumbers.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(horizontal = 40.dp), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Default.Block,
                        contentDescription = null,
                        tint = TextSecondary,
                        modifier = Modifier.size(48.dp),
                    )
                    Spacer(Modifier.height(12.dp))
                    Text(
                        stringResource(R.string.blocked_numbers_no_blocked_numbers),
                        color = White,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = TextSize.Headline,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        stringResource(R.string.blocked_numbers_scam_senders_bantai_blocks_and),
                        color = TextSecondary,
                        fontSize = TextSize.Subhead,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = LocalBottomBarClearance.current),
            ) {
                item {
                    Text(
                        "${blockedNumbers.size} sender${if (blockedNumbers.size != 1) "s" else ""} blocked",
                        color = TextSecondary,
                        fontSize = TextSize.Footnote,
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
                    )
                }
                if (serverOnlyCount > 0) {
                    item {
                        ServerOnlyNotice(
                            count = serverOnlyCount,
                            isDefaultSmsApp = isDefaultSmsApp,
                            onFix = {
                                if (isDefaultSmsApp) {
                                    viewModel.blockOnDevice()
                                } else {
                                    runCatching { defaultSmsLauncher.launch(BlockHelper.defaultSmsAppIntent(context)) }
                                }
                            },
                        )
                    }
                }
                items(blockedNumbers, key = { it.id }) { entry ->
                    BlockedRow(
                        entry = entry,
                        // A blocked sender's thread is hidden from Messages; this is
                        // where its old conversation is still reachable.
                        onOpen = { navController.navigate(Screen.Detail.createRoute(entry.number)) },
                        onUnblock = { numberToUnblock = entry },
                    )
                    HorizontalDivider(
                        color = Hairline,
                        thickness = 0.5.dp,
                        modifier = Modifier.padding(start = 52.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun BlockedRow(
    entry: BlockHelper.BlockedEntry,
    onOpen: () -> Unit,
    onUnblock: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onOpen)
                .padding(start = 20.dp, end = 8.dp, top = 6.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            if (entry.onDevice) Icons.Default.Block else Icons.Outlined.CloudQueue,
            contentDescription = null,
            tint = if (entry.onDevice) Danger else Suspicious,
            modifier = Modifier.size(20.dp),
        )
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                entry.name ?: entry.number,
                color = White,
                fontWeight = FontWeight.Medium,
                fontSize = TextSize.Body,
            )
            val status =
                stringResource(
                    if (entry.onDevice) R.string.blocked_numbers_on_device else R.string.blocked_numbers_server_only,
                )
            Text(
                if (entry.name != null) "${entry.number} · $status" else status,
                color = TextSecondary,
                fontSize = TextSize.Footnote,
            )
        }
        IconButton(onClick = onUnblock) {
            Icon(
                Icons.Default.Close,
                contentDescription = stringResource(R.string.blocked_numbers_unblock_cd, entry.name ?: entry.number),
                tint = TextSecondary,
            )
        }
    }
}

@Composable
private fun ServerOnlyNotice(
    count: Int,
    isDefaultSmsApp: Boolean,
    onFix: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
                .background(Suspicious.copy(alpha = 0.12f), RoundedCornerShape(14.dp))
                .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            pluralStringResource(R.plurals.blocked_numbers_not_on_device, count, count),
            color = White,
            fontWeight = FontWeight.SemiBold,
            fontSize = TextSize.Body,
        )
        Text(
            stringResource(
                if (isDefaultSmsApp) {
                    R.string.blocked_numbers_fix_detail_default
                } else {
                    R.string.blocked_numbers_fix_detail
                },
            ),
            color = TextSecondary,
            fontSize = TextSize.Subhead,
            lineHeight = 20.sp,
        )
        Text(
            stringResource(
                if (isDefaultSmsApp) R.string.blocked_numbers_block_on_device else R.string.default_sms_prompt_title,
            ),
            color = Indigo,
            fontWeight = FontWeight.SemiBold,
            fontSize = TextSize.Subhead,
            modifier = Modifier.clickable(onClick = onFix).padding(vertical = 8.dp),
        )
    }
}
