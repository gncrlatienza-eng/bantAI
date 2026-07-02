package com.bantai.ui.screens.main

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.bantai.ui.theme.*
import com.bantai.util.BlockHelper
import com.bantai.viewmodel.BlockedNumbersViewModel

@Composable
fun BlockedNumbersScreen(
    navController: NavController,
    viewModel: BlockedNumbersViewModel = viewModel(),
) {
    val blockedNumbers by viewModel.blockedNumbers.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    var numberToUnblock by remember { mutableStateOf<BlockHelper.BlockedEntry?>(null) }

    // Unblock confirmation dialog
    numberToUnblock?.let { entry ->
        AlertDialog(
            onDismissRequest = { numberToUnblock = null },
            containerColor = Color(0xFF1A1A1A),
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
                    Text("Unblock", color = Color(0xFF5B4FE8), fontWeight = FontWeight.Bold)
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
        modifier = Modifier
            .fillMaxSize()
            .background(Black),
    ) {
        // Top bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 16.dp),
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
            Text(
                "Blocked Numbers",
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
            )
        }

        if (isLoading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Color(0xFF5B4FE8))
            }
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
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            Icons.Default.Block,
                            contentDescription = null,
                            tint = Color(0xFFFF3B30),
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
                            modifier = Modifier
                                .size(20.dp)
                                .clickable { numberToUnblock = entry },
                        )
                    }
                    HorizontalDivider(
                        color = Color(0xFF1A1A1A),
                        thickness = 0.5.dp,
                        modifier = Modifier.padding(horizontal = 20.dp),
                    )
                }
            }
        }
    }
}
