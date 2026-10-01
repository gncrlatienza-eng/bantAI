package com.bantai.ui.screens.main.thread

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.outlined.AddPhotoAlternate
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.bantai.R
import com.bantai.data.GroupThreads
import com.bantai.data.OutgoingSms
import com.bantai.data.model.SmsMessage
import com.bantai.data.model.isGroupKey
import com.bantai.mms.needsMms
import com.bantai.ui.components.MAX_MMS_PHOTOS
import com.bantai.ui.components.PhotoAttachmentStrip
import com.bantai.ui.components.SimSelector
import com.bantai.ui.components.rememberPhotoPicker
import com.bantai.ui.components.rememberSmsSendPermission
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.IosBlue
import com.bantai.ui.theme.OnIndigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White
import com.bantai.util.SimChoice
import com.bantai.viewmodel.MessageDetailViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Composable
// Text field, photos, send button (SMS or MMS) and the scam-reply confirmation.
@Suppress("LongMethod", "LongParameterList", "CyclomaticComplexMethod")
internal fun ReplyBar(
    sender: String,
    replyText: String,
    onReplyTextChange: (String) -> Unit,
    viewModel: MessageDetailViewModel,
    warnBeforeSending: Boolean,
    subId: Int,
    replyingTo: SmsMessage?,
    replyingToName: String?,
    onCancelReply: () -> Unit,
) {
    val context = LocalContext.current
    val withSmsPermission = rememberSmsSendPermission()
    // Replying to a scammer confirms the number is live and is how most OTP /
    // money scams move forward, so a thread BantAI flagged as a scam asks once
    // before the first reply goes out.
    var showScamReplyWarning by remember { mutableStateOf(false) }
    var scamReplyConfirmed by remember(sender) { mutableStateOf(false) }
    val photos = remember(sender) { mutableStateListOf<Uri>() }
    // Dual-SIM: which SIM this reply goes out on (see SimChoice).
    val sims = remember { SimChoice.activeSims(context) }
    var chosenSub by remember(sender, subId) {
        mutableStateOf(SimChoice.pick(sims, SimChoice.remembered(context, sender), subId, SimChoice.defaultSmsSub()))
    }
    val sendSub = chosenSub ?: subId
    // A group's members, read off the main thread (a provider query when not cached).
    val groupMembers by produceState(emptyList<String>(), sender) {
        if (isGroupKey(sender)) value = withContext(Dispatchers.IO) { GroupThreads.participantsOf(context, sender) }
    }
    val pickPhotos =
        rememberPhotoPicker { picked ->
            picked.filterNot { it in photos }.take(MAX_MMS_PHOTOS - photos.size).let(photos::addAll)
        }
    val canSend = replyText.isNotBlank() || photos.isNotEmpty()

    fun send() {
        val body = replyText.trim()
        if (body.isEmpty() && photos.isEmpty()) return
        // A group reply goes to everyone in it; see needsMms for SMS vs MMS.
        val recipients = if (isGroupKey(sender)) groupMembers else listOf(sender)
        if (recipients.isEmpty()) return
        // The bubble shows "Sending…" at once and settles to sent or
        // "Not delivered · Tap to retry" -- see OutgoingSms.
        withSmsPermission {
            if (needsMms(recipients.size, photos.size)) {
                OutgoingSms.sendMms(context, recipients, body, photos.toList(), sendSub)
            } else {
                OutgoingSms.send(context, sender, body, sendSub)
            }
            replyingTo?.let { viewModel.rememberReplyQuote(body, it) }
            onCancelReply()
            viewModel.clearDraft()
            onReplyTextChange("")
            photos.clear()
        }
    }

    if (showScamReplyWarning) {
        AlertDialog(
            onDismissRequest = { showScamReplyWarning = false },
            containerColor = SurfaceElevated,
            icon = { Icon(Icons.Outlined.WarningAmber, contentDescription = null, tint = Danger) },
            title = { Text(stringResource(R.string.thread_reply_warning_title), color = White) },
            text = { Text(stringResource(R.string.thread_reply_warning_detail), color = TextSecondary) },
            confirmButton = {
                TextButton(onClick = {
                    showScamReplyWarning = false
                    scamReplyConfirmed = true
                    send()
                }) { Text(stringResource(R.string.thread_reply_warning_send), color = Danger) }
            },
            dismissButton = {
                TextButton(onClick = { showScamReplyWarning = false }) {
                    Text(
                        stringResource(R.string.thread_reply_warning_cancel),
                        color = Indigo,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            },
        )
    }

    HorizontalDivider(color = Surface)
    replyingTo?.let { ReplyingToBar(it, replyingToName, onCancelReply) }
    PhotoAttachmentStrip(photos, onRemove = { photos.remove(it) }, modifier = Modifier.padding(top = 8.dp))
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        SimSelector(sims, chosenSub, onSelect = {
            chosenSub = it
            SimChoice.remember(context, sender, it)
        })
        IconButton(onClick = pickPhotos, enabled = photos.size < MAX_MMS_PHOTOS, modifier = Modifier.size(36.dp)) {
            Icon(
                Icons.Outlined.AddPhotoAlternate,
                contentDescription = stringResource(R.string.attachment_add_photo),
                tint = Indigo,
            )
        }
        Box(
            modifier =
                Modifier
                    .weight(1f)
                    .background(Surface, RoundedCornerShape(22.dp))
                    .padding(horizontal = 16.dp, vertical = 10.dp),
        ) {
            BasicTextField(
                value = replyText,
                onValueChange = onReplyTextChange,
                textStyle = TextStyle(color = White, fontSize = TextSize.Subhead),
                cursorBrush = SolidColor(Indigo),
                modifier = Modifier.fillMaxWidth(),
                decorationBox = { inner ->
                    if (replyText.isEmpty()) {
                        Text(
                            stringResource(R.string.message_detail_message),
                            color = TextSecondary,
                            fontSize = TextSize.Subhead,
                        )
                    }
                    inner()
                },
            )
        }
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .background(if (canSend) Indigo else Surface, CircleShape)
                    .clickable {
                        if (!canSend) return@clickable
                        if (warnBeforeSending && !scamReplyConfirmed) showScamReplyWarning = true else send()
                    },
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Filled.ArrowUpward,
                contentDescription = stringResource(R.string.action_send),
                tint = if (canSend) OnIndigo else TextSecondary,
                modifier = Modifier.size(20.dp),
            )
        }
    }
}

@Composable
internal fun UnreachableSenderNotice(sender: String) {
    HorizontalDivider(color = Surface)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 16.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.Center,
    ) {
        Text(
            stringResource(R.string.thread_cant_reply, sender),
            color = TextSecondary,
            fontSize = TextSize.Caption,
            textAlign = TextAlign.Center,
        )
    }
}

// Recently Deleted's bottom bar, in place of the reply field: recover or
// delete everything shown (select messages first to act on just those).
@Composable
internal fun DeletedActionsBar(
    onRecover: () -> Unit,
    onDelete: () -> Unit,
    enabled: Boolean,
) {
    HorizontalDivider(color = Surface)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        TextButton(onClick = onRecover, enabled = enabled) {
            Text(stringResource(R.string.deleted_recover_all), color = IosBlue, fontSize = TextSize.Body)
        }
        TextButton(onClick = onDelete, enabled = enabled) {
            Text(stringResource(R.string.deleted_delete_all), color = Danger, fontSize = TextSize.Body)
        }
    }
}
