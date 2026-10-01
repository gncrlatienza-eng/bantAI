package com.bantai.ui.screens.main.thread

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Forward
import androidx.compose.material.icons.automirrored.outlined.Reply
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.ReportGmailerrorred
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.bantai.R
import com.bantai.data.db.ReplyQuoteEntity
import com.bantai.data.model.SendStatus
import com.bantai.data.model.SmsMessage
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White
import com.bantai.util.SmsLinkSafety
import kotlin.math.roundToInt

/**
 * Text that leaves a bubble through Copy or Forward: the same text the bubble
 * shows, so a flagged message's hidden links stay hidden when it's passed on.
 */
fun shareableText(message: SmsMessage): String {
    val text = message.mms?.text ?: message.body
    return if (message.isOutgoing) text else SmsLinkSafety.visibleBody(text, message.classification, message.sender)
}

/** One row of a message's long-press card. */
data class MessageAction(
    val label: Int,
    val icon: ImageVector,
    val danger: Boolean = false,
    val onClick: () -> Unit,
)

/**
 * The actions a message offers. There is no "Unsend": an SMS the carrier
 * accepted is already on the other phone, and one still "Sending…" has been
 * handed to the radio, which can't be called back.
 */
@Suppress("LongParameterList") // one callback per action
fun messageActions(
    message: SmsMessage,
    canReply: Boolean,
    canReport: Boolean,
    onReply: () -> Unit,
    onCopy: () -> Unit,
    onForward: () -> Unit,
    onReport: () -> Unit,
    onSelect: () -> Unit,
    onRetry: () -> Unit,
    onDelete: () -> Unit,
): List<MessageAction> {
    val hasText = (message.mms?.text ?: message.body).isNotBlank()
    val failed = message.isOutgoing && message.sendStatus == SendStatus.FAILED
    // Not downloaded yet: nothing to reply to, copy, forward or report.
    if (message.mmsDownload != null) {
        return listOf(
            MessageAction(R.string.thread_action_select, Icons.Outlined.CheckCircle, onClick = onSelect),
            MessageAction(R.string.action_delete, Icons.Outlined.Delete, danger = true, onClick = onDelete),
        )
    }
    return buildList {
        if (failed) add(MessageAction(R.string.thread_action_retry, Icons.Outlined.Refresh, onClick = onRetry))
        if (canReply && !failed && message.sendStatus != SendStatus.SENDING) {
            add(MessageAction(R.string.thread_action_reply, Icons.AutoMirrored.Outlined.Reply, onClick = onReply))
        }
        if (hasText) {
            add(MessageAction(R.string.thread_action_copy, Icons.Outlined.ContentCopy, onClick = onCopy))
            add(MessageAction(R.string.thread_action_forward, Icons.AutoMirrored.Outlined.Forward, onClick = onForward))
        }
        if (canReport) {
            val icon = Icons.Outlined.ReportGmailerrorred
            add(MessageAction(R.string.message_detail_report_message, icon, onClick = onReport))
        }
        add(MessageAction(R.string.thread_action_select, Icons.Outlined.CheckCircle, onClick = onSelect))
        add(MessageAction(R.string.action_delete, Icons.Outlined.Delete, danger = true, onClick = onDelete))
    }
}

/** The long-pressed message and where its bubble sits on screen (window coordinates). */
data class FocusedMessage(
    val message: SmsMessage,
    val bubbleBounds: Rect,
)

private const val DIM_ALPHA = 0.6f
private const val ENTER_MS = 180
private const val CARD_START_SCALE = 0.85f
private const val LIFT_SCALE = 0.03f

/**
 * iMessage/Telegram-style long press: the thread dims, the pressed bubble is
 * drawn above the dim where it was, and a compact action card opens right
 * under it, lined up with the bubble's side. When there's no room below, the
 * bubble and card slide up together. Tapping outside, or Back, closes it.
 */
@Suppress("LongMethod") // the bubble/card placement is one measure pass
@Composable
fun FocusedMessageOverlay(
    focused: FocusedMessage,
    actions: List<MessageAction>,
    onDismiss: () -> Unit,
    bubble: @Composable () -> Unit,
) {
    BackHandler(onBack = onDismiss)
    var origin by remember { mutableStateOf(Offset.Zero) }
    var appeared by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { appeared = true }
    val progress by animateFloatAsState(if (appeared) 1f else 0f, tween(ENTER_MS), label = "focus")
    val outgoing = focused.message.isOutgoing
    val density = LocalDensity.current
    // Keep the card clear of the status bar, and of the nav bar or keyboard.
    val topInset = WindowInsets.systemBars.getTop(density)
    val bottomInset = WindowInsets.systemBars.union(WindowInsets.ime).getBottom(density)
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .onGloballyPositioned { origin = it.positionInWindow() }
                .background(Color.Black.copy(alpha = DIM_ALPHA * progress))
                .pointerInput(Unit) { detectTapGestures { onDismiss() } },
    ) {
        Layout(
            modifier = Modifier.fillMaxSize(),
            content = {
                // Scale first, then clip: the clip (which only cuts a very long
                // message to fit) sits inside the enlarged layer, so the lift
                // never trims the bubble's rounded edges.
                Box(
                    Modifier
                        .graphicsLayer {
                            val scale = 1f + LIFT_SCALE * progress
                            scaleX = scale
                            scaleY = scale
                        }.clipToBounds(),
                ) { bubble() }
                ActionCard(
                    actions = actions,
                    onDismiss = onDismiss,
                    modifier =
                        Modifier.graphicsLayer {
                            alpha = progress
                            val scale = CARD_START_SCALE + (1f - CARD_START_SCALE) * progress
                            scaleX = scale
                            scaleY = scale
                            transformOrigin = TransformOrigin(if (outgoing) 1f else 0f, 0f)
                        },
                )
            },
        ) { measurables, constraints ->
            val loose = constraints.copy(minWidth = 0, minHeight = 0)
            val gap = 8.dp.roundToPx()
            val margin = 12.dp.roundToPx()
            val minTop = topInset + margin
            val maxBottom = constraints.maxHeight - bottomInset - margin
            val card = measurables[1].measure(loose)
            // A very long message is cut so the card still fits on screen.
            val bubbleRoom = (maxBottom - minTop - card.height - gap).coerceAtLeast(0)
            val bubble = measurables[0].measure(loose.copy(maxHeight = bubbleRoom))
            // bubbleBounds is in window coordinates; this layout starts at [origin].
            val left = (focused.bubbleBounds.left - origin.x).roundToInt()
            val right = (focused.bubbleBounds.right - origin.x).roundToInt()
            val total = bubble.height + gap + card.height
            val top =
                (focused.bubbleBounds.top - origin.y)
                    .roundToInt()
                    .coerceAtMost(maxBottom - total)
                    .coerceAtLeast(minTop)
            val maxCardX = (constraints.maxWidth - card.width - margin).coerceAtLeast(margin)
            val cardX = (if (outgoing) right - card.width else left).coerceIn(margin, maxCardX)
            layout(constraints.maxWidth, constraints.maxHeight) {
                bubble.place(if (outgoing) right - bubble.width else left, top)
                card.place(cardX, top + bubble.height + gap)
            }
        }
    }
}

@Composable
private fun ActionCard(
    actions: List<MessageAction>,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .width(230.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(SurfaceElevated),
    ) {
        actions.forEachIndexed { index, action ->
            if (index > 0) HorizontalDivider(color = Hairline, thickness = 0.5.dp)
            val tint = if (action.danger) Danger else White
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clickable {
                            onDismiss()
                            action.onClick()
                        }.padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    stringResource(action.label),
                    color = tint,
                    fontSize = TextSize.Body,
                    modifier = Modifier.weight(1f),
                )
                Icon(action.icon, contentDescription = null, tint = tint, modifier = Modifier.size(20.dp))
            }
        }
    }
}

/** The quoted message shown at the top of a sent reply's bubble (this phone only). */
@Composable
fun QuoteBlock(
    quote: ReplyQuoteEntity,
    otherPartyName: String,
) {
    val accent = Indigo
    Row(
        modifier =
            Modifier
                .padding(bottom = 6.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(TextTertiary.copy(alpha = 0.15f)),
    ) {
        Box(Modifier.width(3.dp).height(40.dp).background(accent))
        Column(Modifier.padding(horizontal = 8.dp, vertical = 4.dp)) {
            Text(
                if (quote.quotedOutgoing) stringResource(R.string.thread_quote_you) else otherPartyName,
                color = accent,
                fontSize = TextSize.Caption,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                quote.quotedBody,
                color = TextSecondary,
                fontSize = TextSize.Footnote,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/** Shown above the reply field while replying to a specific message. */
@Composable
fun ReplyingToBar(
    message: SmsMessage,
    otherPartyName: String?,
    onCancel: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 4.dp, top = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.width(3.dp).height(36.dp).background(Indigo))
        Spacer(Modifier.width(8.dp))
        Column(Modifier.weight(1f)) {
            Text(
                stringResource(
                    R.string.thread_replying_to,
                    otherPartyName ?: stringResource(R.string.thread_quote_you),
                ),
                color = Indigo,
                fontSize = TextSize.Caption,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                message.mms?.text?.ifBlank { null } ?: message.body,
                color = TextSecondary,
                fontSize = TextSize.Footnote,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        IconButton(onClick = onCancel) {
            Icon(
                Icons.Filled.Close,
                contentDescription = stringResource(R.string.thread_cancel_reply),
                tint = TextSecondary,
                modifier = Modifier.size(18.dp),
            )
        }
    }
}
