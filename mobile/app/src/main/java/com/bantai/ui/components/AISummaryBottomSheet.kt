package com.bantai.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Safe
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.Suspicious
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.White

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AISummaryBottomSheet(
    onDismiss: () -> Unit,
    onViewFullAnalysis: () -> Unit,
    isSuspicious: Boolean = true,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Surface,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
        dragHandle = { BottomSheetDefaults.DragHandle() },
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp)
                .padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Icon(Icons.Default.Psychology, contentDescription = null, tint = Indigo, modifier = Modifier.size(20.dp))
                Text(
                    "AI Summary",
                    color = White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = onDismiss, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Default.Close, contentDescription = "Close", tint = Color(0xFF666666), modifier = Modifier.size(18.dp))
                }
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                val verdictColor = if (isSuspicious) Suspicious else Safe
                Box(
                    modifier = Modifier
                        .background(verdictColor.copy(alpha = 0.2f), RoundedCornerShape(100.dp))
                        .padding(horizontal = 8.dp, vertical = 3.dp),
                ) {
                    Text(
                        if (isSuspicious) "Suspicious" else "Looks safe",
                        color = verdictColor,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
                Text(
                    if (isSuspicious) "68% confidence" else "92% confidence",
                    color = TextSecondary,
                    fontSize = 12.sp,
                )
            }

            Text(
                if (isSuspicious) {
                    "This message contains suspicious patterns — an unverified external link and urgency language. It may be legitimate but proceed with caution. Do not share personal information."
                } else {
                    "No smishing indicators found in this conversation. The sender and message contents look consistent with legitimate messaging. Stay alert for unexpected links or requests for personal information."
                },
                color = White,
                fontSize = 14.sp,
                lineHeight = 20.sp,
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF16163A), RoundedCornerShape(16.dp))
                    .border(1.dp, Indigo, RoundedCornerShape(16.dp))
                    .clickable(onClick = onViewFullAnalysis)
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Icon(Icons.Default.Psychology, contentDescription = null, tint = Indigo, modifier = Modifier.size(20.dp))
                Text(
                    "View full threat analysis",
                    color = Indigo,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    modifier = Modifier.weight(1f),
                )
                Icon(Icons.Default.ChevronRight, contentDescription = null, tint = Indigo, modifier = Modifier.size(20.dp))
            }
        }
    }
}
