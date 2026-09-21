@file:Suppress("MagicNumber")

package com.bantai.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Surface

// Shows the shape of what's coming instead of a spinner's "something is
// happening" -- used for content that loads into a known layout (a list row,
// a detail page). Button/inline in-progress indicators (e.g. a Save button's
// spinner) intentionally still use CircularProgressIndicator: there's no
// content shape to preview there, just an action in flight.

@Composable
private fun shimmerBrush(): Brush {
    val transition = rememberInfiniteTransition(label = "skeletonShimmer")
    val translate by transition.animateFloat(
        initialValue = -600f,
        targetValue = 600f,
        animationSpec =
            infiniteRepeatable(
                animation = tween(1100, easing = LinearEasing),
                repeatMode = RepeatMode.Restart,
            ),
        label = "skeletonShimmerTranslate",
    )
    return Brush.linearGradient(
        colors = listOf(Surface, Hairline, Surface),
        start = Offset(translate - 200f, 0f),
        end = Offset(translate + 200f, 0f),
    )
}

@Composable
fun SkeletonBlock(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(6.dp),
) {
    Box(modifier = modifier.clip(shape).background(shimmerBrush()))
}

@Composable
private fun SkeletonCircle(size: Dp) {
    SkeletonBlock(modifier = Modifier.size(size), shape = CircleShape)
}

/**
 * One list row's worth of placeholder — avatar + two text lines. Defaults
 * match the real row in MessagesScreen (40dp avatar, 20dp horizontal
 * padding); pass smaller values to fit a more compact list, e.g. the
 * "Recent alerts" card in NotificationsScreen.
 */
@Composable
fun MessageRowSkeleton(
    modifier: Modifier = Modifier,
    avatarSize: Dp = 40.dp,
    horizontalPadding: Dp = 20.dp,
    verticalPadding: Dp = 12.dp,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(horizontal = horizontalPadding, vertical = verticalPadding),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        SkeletonCircle(avatarSize)
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            SkeletonBlock(modifier = Modifier.width(avatarSize * 4).height(14.dp))
            SkeletonBlock(modifier = Modifier.width(avatarSize * 6).height(12.dp))
        }
    }
}

/** A full list screen's initial-load placeholder — a handful of row skeletons. */
@Composable
fun ListSkeleton(
    modifier: Modifier = Modifier,
    rows: Int = 6,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        repeat(rows) { MessageRowSkeleton() }
    }
}

/**
 * Placeholder for a single detail/content screen — header lines, a large
 * content block, then two side-by-side stat-style blocks. Shared by
 * CampaignDetail/SmishingAlert/ThreatAnalysis rather than a bespoke skeleton
 * per screen, since all three load into the same rough shape: a title, a
 * summary line, a main content card, and a couple of stat tiles.
 */
@Composable
fun DetailSkeleton(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxWidth().padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        SkeletonBlock(modifier = Modifier.fillMaxWidth(0.6f).height(20.dp))
        SkeletonBlock(modifier = Modifier.fillMaxWidth(0.4f).height(14.dp))
        SkeletonBlock(modifier = Modifier.fillMaxWidth().height(120.dp), shape = RoundedCornerShape(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            SkeletonBlock(modifier = Modifier.weight(1f).height(60.dp), shape = RoundedCornerShape(12.dp))
            SkeletonBlock(modifier = Modifier.weight(1f).height(60.dp), shape = RoundedCornerShape(12.dp))
        }
        SkeletonBlock(modifier = Modifier.fillMaxWidth().height(80.dp), shape = RoundedCornerShape(16.dp))
    }
}

/** Placeholder for a chat-style conversation thread — alternating bubble sides/widths. */
@Composable
fun ChatThreadSkeleton(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        listOf(0.55f, 0.7f, 0.4f, 0.6f).forEachIndexed { index, width ->
            val fromOther = index % 2 == 0
            Box(
                modifier = Modifier.fillMaxWidth(),
                contentAlignment = if (fromOther) Alignment.CenterStart else Alignment.CenterEnd,
            ) {
                SkeletonBlock(
                    modifier = Modifier.fillMaxWidth(width).height(if (fromOther) 36.dp else 44.dp),
                    shape = RoundedCornerShape(16.dp),
                )
            }
        }
    }
}
