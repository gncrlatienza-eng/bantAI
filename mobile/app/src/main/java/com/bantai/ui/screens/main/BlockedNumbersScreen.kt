package com.bantai.ui.screens.main

import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Block
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
import com.bantai.ui.components.GroupedFooter
import com.bantai.ui.components.GroupedSectionHeader
import com.bantai.ui.components.IosTopBar
import com.bantai.ui.components.ListSkeleton
import com.bantai.ui.components.LocalBottomBarClearance
import com.bantai.ui.components.UnblockConfirmDialog
import com.bantai.ui.components.groupedItem
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
        IosTopBar(
            title = stringResource(R.string.blocked_numbers_blocked_numbers),
            onBack = { navController.popBackStack() },
        )

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
                    GroupedSectionHeader(
                        "${blockedNumbers.size} sender${if (blockedNumbers.size != 1) "s" else ""} blocked",
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
                // A blocked number is blocked: tapping it only offers to unblock,
                // it doesn't open the conversation.
                itemsIndexed(blockedNumbers, key = { _, entry -> entry.id }) { index, entry ->
                    Column(Modifier.groupedItem(index, blockedNumbers.lastIndex)) {
                        BlockedRow(entry = entry, onUnblock = { numberToUnblock = entry })
                        if (index != blockedNumbers.lastIndex) {
                            HorizontalDivider(
                                color = Hairline,
                                thickness = 0.5.dp,
                                modifier = Modifier.padding(start = 48.dp),
                            )
                        }
                    }
                }
                item { GroupedFooter(stringResource(R.string.retention_blocked_messages)) }
            }
        }
    }
}

@Composable
private fun BlockedRow(
    entry: BlockHelper.BlockedEntry,
    onUnblock: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(
                    onClickLabel = stringResource(R.string.blocked_numbers_unblock_cd, entry.name ?: entry.number),
                    onClick = onUnblock,
                ).padding(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 10.dp),
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
        Text(
            stringResource(R.string.blocked_numbers_unblock),
            color = IosBlue,
            fontSize = TextSize.Subhead,
            modifier = Modifier.padding(start = 12.dp),
        )
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
