package com.bantai.ui.screens.main

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.ui.components.ListSkeleton
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
    val syncError by viewModel.syncError.collectAsState()
    var numberToUnblock by remember { mutableStateOf<BlockHelper.BlockedEntry?>(null) }

    LaunchedEffect(syncError) {
        if (syncError != null) {
            Toast.makeText(context, syncError, Toast.LENGTH_LONG).show()
            viewModel.clearSyncError()
        }
    }

    // Unblock confirmation dialog
    numberToUnblock?.let { entry ->
        AlertDialog(
            onDismissRequest = { numberToUnblock = null },
            containerColor = Surface,
            title = {
                Text("Unblock number?", color = White, fontWeight = FontWeight.Bold)
            },
            text = {
                Text(
                    "${entry.number} will be removed from your blocked list and can send you messages again.",
                    color = TextSecondary,
                    fontSize = 13.sp,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.unblockNumber(entry)
                    numberToUnblock = null
                }) {
                    Text("Unblock", color = Indigo, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { numberToUnblock = null }) {
                    Text("Cancel", color = TextSecondary)
                }
            },
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
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = White)
            }
            Text(
                "Blocked Numbers",
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp,
                modifier = Modifier.align(Alignment.Center),
            )
        }
        HorizontalDivider(color = Surface)

        if (isLoading) {
            ListSkeleton(rows = 6)
        } else if (blockedNumbers.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Default.Block,
                        contentDescription = null,
                        tint = TextSecondary,
                        modifier = Modifier.size(48.dp),
                    )
                    Spacer(Modifier.height(12.dp))
                    Text("No blocked numbers", color = TextSecondary, fontSize = 14.sp)
                    Text(
                        "Numbers you block will appear here",
                        color = Color(0xFF4A4A4A),
                        fontSize = 12.sp,
                    )
                }
            }
        } else {
            Text(
                "${blockedNumbers.size} number${if (blockedNumbers.size != 1) "s" else ""} blocked",
                color = TextSecondary,
                fontSize = 12.sp,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp),
            )

            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(blockedNumbers) { entry ->
                    Row(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            Icons.Default.Block,
                            contentDescription = null,
                            tint = Danger,
                            modifier = Modifier.size(20.dp),
                        )
                        Spacer(Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                entry.number,
                                color = White,
                                fontWeight = FontWeight.Medium,
                                fontSize = 14.sp,
                            )
                            Text(
                                "Blocked by BantAI",
                                color = TextSecondary,
                                fontSize = 12.sp,
                            )
                        }
                        Icon(
                            Icons.Default.Close,
                            contentDescription = "Unblock",
                            tint = Color(0xFF666666),
                            modifier =
                                Modifier
                                    .size(20.dp)
                                    .clickable { numberToUnblock = entry },
                        )
                    }
                    HorizontalDivider(
                        color = Surface,
                        thickness = 0.5.dp,
                        modifier = Modifier.padding(horizontal = 20.dp),
                    )
                }
            }
        }
    }
}
