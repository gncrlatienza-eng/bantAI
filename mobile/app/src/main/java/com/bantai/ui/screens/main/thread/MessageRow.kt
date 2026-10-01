package com.bantai.ui.screens.main.thread

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bantai.R
import com.bantai.data.db.ReplyQuoteEntity
import com.bantai.data.model.Classification
import com.bantai.data.model.MmsDownloadState
import com.bantai.data.model.PendingMmsDownload
import com.bantai.data.model.SendStatus
import com.bantai.data.model.SmsMessage
import com.bantai.ui.components.MmsImages
import com.bantai.ui.components.SenderAvatar
import com.bantai.ui.theme.BubbleReceived
import com.bantai.ui.theme.BubbleSent
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White
import com.bantai.util.MessageTime
import com.bantai.util.SmsLinkSafety

/**
 * One message in a thread: avatar, bubble, the selection circle, and "Not
 * delivered · tap to retry" for a failed send. A long press reports where the
 * bubble is on screen, so the focused copy and its menu can open right there
 * (see FocusedMessageOverlay). [hidden] hides the bubble while that copy is up.
 */
@Suppress("LongParameterList", "LongMethod") // avatar, bubble, selection, group label, delivered/failed lines
@OptIn(ExperimentalFoundationApi::class) // combinedClickable
@Composable
internal fun MessageRow(
    msg: SmsMessage,
    selectionMode: Boolean,
    isSelected: Boolean,
    isTrusted: Boolean,
    bubbleMaxWidth: Dp,
    quote: ReplyQuoteEntity?,
    otherPartyName: String,
    hidden: Boolean,
    onClick: () -> Unit,
    // Who wrote an incoming message in a group thread; null in a 1:1 thread.
    senderLabel: String? = null,
    // "Delivered" under the thread's last sent message, iMessage-style.
    showDelivered: Boolean = false,
    onLongClick: (bubbleBounds: Rect) -> Unit,
    onRetry: () -> Unit,
) {
    val isOutgoing = msg.isOutgoing
    var bubbleBounds by remember { mutableStateOf(Rect.Zero) }
    val longPress = { onLongClick(bubbleBounds) }
    Column(
        modifier = Modifier.fillMaxWidth().combinedClickable(onClick = onClick, onLongClick = longPress),
        horizontalAlignment = if (isOutgoing) Alignment.End else Alignment.Start,
    ) {
        senderLabel?.let {
            Text(
                it,
                color = TextSecondary,
                fontSize = TextSize.Caption2,
                maxLines = 1,
                modifier = Modifier.padding(start = if (selectionMode) 70.dp else 44.dp, bottom = 2.dp),
            )
        }
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            if (selectionMode) {
                Icon(
                    imageVector = if (isSelected) Icons.Filled.CheckCircle else Icons.Outlined.Circle,
                    contentDescription =
                        stringResource(if (isSelected) R.string.cd_selected else R.string.cd_not_selected),
                    tint = if (isSelected) Indigo else TextTertiary,
                    modifier = Modifier.size(20.dp),
                )
            }
            if (!isOutgoing) SenderAvatar(sender = msg.sender, size = 28.dp)
            MessageBubble(
                msg = msg,
                isTrusted = isTrusted,
                bubbleMaxWidth = bubbleMaxWidth,
                quote = quote,
                otherPartyName = otherPartyName,
                onImageLongClick = longPress,
                modifier =
                    Modifier
                        .alpha(if (hidden) 0f else 1f)
                        .onGloballyPositioned { bubbleBounds = it.boundsInWindow() },
            )
        }
        if (showDelivered) {
            Text(
                stringResource(R.string.thread_delivered),
                color = TextSecondary,
                fontSize = TextSize.Caption2,
                modifier = Modifier.padding(top = 2.dp, end = 4.dp),
            )
        }
        if (isOutgoing && msg.sendStatus == SendStatus.FAILED) {
            Row(
                modifier = Modifier.padding(top = 2.dp).clickable(onClick = onRetry),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Icon(Icons.Default.Warning, contentDescription = null, tint = Danger, modifier = Modifier.size(16.dp))
                Text(stringResource(R.string.thread_not_delivered), color = Danger, fontSize = TextSize.Footnote)
            }
        }
    }
}

/**
 * A message's bubble: reply quote, pictures, text and time. Drawn in the
 * thread and again, lifted, above the long-press dim.
 */
@Suppress("LongParameterList", "CyclomaticComplexMethod", "LongMethod") // incoming/outgoing/failed/scam/pending styling
@Composable
internal fun MessageBubble(
    msg: SmsMessage,
    isTrusted: Boolean,
    bubbleMaxWidth: Dp,
    quote: ReplyQuoteEntity?,
    otherPartyName: String,
    onImageLongClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val isOutgoing = msg.isOutgoing
    val flaggedScam = !isOutgoing && msg.classification == Classification.SCAM && !isTrusted
    val background =
        when {
            // A failed message used to be drawn at half strength; its text then
            // sat on a muddy, half-transparent fill and was hard to read
            // (black on grey with the white accent). The red "Not delivered"
            // line under it already says it failed.
            isOutgoing -> BubbleSent
            flaggedScam -> Danger.copy(alpha = 0.15f)
            else -> BubbleReceived
        }
    // The corner nearest the sender's side is the "tail".
    val shape =
        if (isOutgoing) {
            RoundedCornerShape(topStart = 16.dp, topEnd = 4.dp, bottomEnd = 16.dp, bottomStart = 16.dp)
        } else {
            RoundedCornerShape(topStart = 4.dp, topEnd = 16.dp, bottomEnd = 16.dp, bottomStart = 16.dp)
        }
    val photos = msg.mms?.images.orEmpty()
    if (photos.isNotEmpty() && msg.mmsDownload == null) {
        PhotoBubble(msg, photos, bubbleMaxWidth, background, shape, onImageLongClick, modifier)
        return
    }
    Box(
        modifier =
            modifier
                .widthIn(max = bubbleMaxWidth)
                .background(background, shape)
                .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        Column {
            quote?.let { QuoteBlock(it, otherPartyName) }
            msg.mmsDownload?.let {
                PendingMmsContent(it)
                return@Column
            }
            val text = msg.mms?.text ?: msg.body
            if (text.isNotBlank()) {
                Text(
                    if (isOutgoing) text else SmsLinkSafety.visibleBody(text, msg.classification, msg.sender),
                    color = White,
                    fontSize = TextSize.Subhead,
                    lineHeight = 20.sp,
                )
            }
            Spacer(Modifier.height(2.dp))
            Text(
                if (isOutgoing && msg.sendStatus == SendStatus.SENDING) {
                    stringResource(R.string.thread_sending)
                } else {
                    MessageTime.clock(msg.timestamp)
                },
                color =
                    when {
                        flaggedScam -> Danger
                        else -> TextSecondary
                    },
                fontSize = TextSize.Caption2,
                modifier = if (isOutgoing) Modifier.align(Alignment.End) else Modifier,
            )
        }
    }
}

/**
 * A picture message, the way messaging apps show one: a photo on its own is
 * just the rounded photo, with no colored frame around it, and a photo with
 * a caption sits flush at the top of the bubble with the caption below.
 * Photos used to sit inside the bubble's padding, which drew a thick border.
 */
@Suppress("LongParameterList") // the bubble's colors and shape come from MessageBubble
@Composable
private fun PhotoBubble(
    msg: SmsMessage,
    photos: List<String>,
    maxWidth: Dp,
    background: Color,
    shape: Shape,
    onImageLongClick: () -> Unit,
    modifier: Modifier,
) {
    val isOutgoing = msg.isOutgoing
    val caption = msg.mms?.text.orEmpty()
    val time =
        if (isOutgoing && msg.sendStatus == SendStatus.SENDING) {
            stringResource(R.string.thread_sending)
        } else {
            MessageTime.clock(msg.timestamp)
        }
    if (caption.isBlank()) {
        val side = if (isOutgoing) Alignment.End else Alignment.Start
        Column(modifier = modifier.width(maxWidth), horizontalAlignment = side) {
            MmsImages(images = photos, maxWidth = maxWidth, onLongClick = onImageLongClick, cornerRadius = 16.dp)
            Text(
                time,
                color = TextSecondary,
                fontSize = TextSize.Caption2,
                modifier = Modifier.padding(top = 2.dp, start = 4.dp, end = 4.dp),
            )
        }
        return
    }
    Column(modifier = modifier.width(maxWidth).clip(shape).background(background)) {
        MmsImages(images = photos, maxWidth = maxWidth, onLongClick = onImageLongClick, cornerRadius = 0.dp)
        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp)) {
            Text(
                if (isOutgoing) caption else SmsLinkSafety.visibleBody(caption, msg.classification, msg.sender),
                color = White,
                fontSize = TextSize.Subhead,
                lineHeight = 20.sp,
            )
            Spacer(Modifier.height(2.dp))
            Text(
                time,
                color = TextSecondary,
                fontSize = TextSize.Caption2,
                modifier = Modifier.align(if (isOutgoing) Alignment.End else Alignment.Start),
            )
        }
    }
}

private const val BYTES_PER_KB = 1024

/**
 * An MMS still on the carrier's server. Tapping the row retries a failed
 * download (MessageDetailScreen); an expired one is gone for good.
 */
@Composable
private fun PendingMmsContent(download: PendingMmsDownload) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(Icons.Outlined.Image, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(28.dp))
        Column {
            val size = (download.sizeBytes / BYTES_PER_KB).takeIf { it > 0 }
            Text(
                if (size != null) {
                    stringResource(R.string.thread_mms_pending_sized, size)
                } else {
                    stringResource(R.string.thread_mms_pending)
                },
                color = White,
                fontSize = TextSize.Subhead,
            )
            Text(
                stringResource(
                    when (download.state) {
                        MmsDownloadState.DOWNLOADING -> R.string.thread_mms_downloading
                        MmsDownloadState.FAILED -> R.string.thread_mms_tap_to_download
                        MmsDownloadState.EXPIRED -> R.string.thread_mms_expired
                    },
                ),
                color = if (download.state == MmsDownloadState.FAILED) Indigo else TextSecondary,
                fontSize = TextSize.Footnote,
            )
        }
    }
}
