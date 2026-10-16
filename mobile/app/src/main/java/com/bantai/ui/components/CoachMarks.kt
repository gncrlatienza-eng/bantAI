package com.bantai.ui.components

import androidx.activity.compose.BackHandler
import androidx.annotation.StringRes
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.VectorConverter
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bantai.R
import com.bantai.container
import com.bantai.ui.screens.main.LocalTabActive
import com.bantai.ui.theme.BantaiShapes
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.OnIndigo
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/** Ids for the controls a walkthrough points at. */
object CoachIds {
    const val FILTER_ALL = "filter_all"
    const val FILTER_SPAM = "filter_spam"
    const val FILTER_UNKNOWN = "filter_unknown"
    const val SEARCH = "search"
    const val TAB_ALERTS = "tab_alerts"
    const val ALERT_TABS = "alert_tabs"
    const val ALERT_FIRST_ROW = "alert_first_row"
    const val VERDICT_ACTIONS = "verdict_actions"
    const val WAVES_TITLE = "waves_title"
    const val WAVES_CHIPS = "waves_chips"
    const val SETTINGS_TITLE = "settings_title"
    const val SETTINGS_WAVES = "settings_waves"
    const val SETTINGS_UNKNOWN = "settings_unknown"
    const val SETTINGS_TIPS = "settings_tips"
    const val SETTINGS_SUPPORT = "settings_support"
    const val SETTINGS_PRIVACY = "settings_privacy"
}

/**
 * One stop on a tour: which control to light up and what to say about it.
 * [tab] switches the main tab first (1 = Alerts), so one tour can walk from
 * Messages into Alerts without the user wondering whether it's still going.
 */
data class CoachStep(
    val targetId: String,
    @StringRes val title: Int,
    @StringRes val body: Int,
    val tab: Int? = null,
)

/** A walkthrough; [key] is what "already seen" is stored under. */
data class CoachTour(
    val key: String,
    val steps: List<CoachStep>,
)

/**
 * Where every [coachTarget] is on screen, and which tour is showing. One per
 * app, provided by [CoachMarkHost], so a tour on Messages can also point at
 * the tab bar drawn outside the Messages screen.
 */
@Stable
class CoachMarkController {
    internal val targets = mutableStateMapOf<String, Rect>()
    internal var tour by mutableStateOf<CoachTour?>(null)
    internal var index by mutableIntStateOf(0)
    internal var onDone: (() -> Unit)? = null

    /** Set by NavGraph: switches the main tab for steps that live on another one. */
    var selectTab: ((Int) -> Unit)? = null

    /**
     * True while something must stay on top (the default-SMS gate): no tour
     * starts or shows, and a waiting one starts once it's cleared.
     */
    var suspended by mutableStateOf(false)

    val isShowing: Boolean get() = tour != null

    /**
     * The control the tour is on right now, or null. Screens watch this to put
     * themselves in the state the step talks about (Spam step -> Spam page,
     * Alerts steps -> To review), so the tour plays the same from any page.
     */
    val currentTarget: String? get() = tour?.steps?.getOrNull(index)?.targetId

    fun start(
        tour: CoachTour,
        onDone: () -> Unit,
    ) {
        // Steps whose control isn't on screen (Unknown hidden) are dropped. Steps on
        // another tab are kept: their controls only appear once that tab opens.
        val steps = tour.steps.filter { it.tab != null || it.targetId in targets }
        if (steps.isEmpty() || this.tour != null || suspended) return
        this.tour = tour.copy(steps = steps)
        this.index = 0
        this.onDone = onDone
        steps.first().tab?.let { selectTab?.invoke(it) }
    }

    internal fun next() {
        val current = tour ?: return
        if (index < current.steps.lastIndex) {
            index++
            current.steps[index].tab?.let { selectTab?.invoke(it) }
        } else {
            finish()
        }
    }

    internal fun finish() {
        tour = null
        onDone?.invoke()
        onDone = null
    }
}

val LocalCoachMarks = staticCompositionLocalOf<CoachMarkController?> { null }

/**
 * Marks this element as something a walkthrough can point at. Put it first in
 * the chain so the spotlight covers the whole control, padding included. The
 * spot is dropped when the control leaves the screen (Hide Unknown turned on
 * mid-tour), so the tour skips it instead of lighting up empty space.
 */
fun Modifier.coachTarget(id: String): Modifier =
    this.composed {
        // A hidden tab stays composed but isn't placed, so its last position
        // would linger and the spotlight would land on empty space.
        val tabActive = LocalTabActive.current
        DisposableEffect(id, tabActive) {
            if (!tabActive) CoachTargetRegistry.current?.targets?.remove(id)
            onDispose { CoachTargetRegistry.current?.targets?.remove(id) }
        }
        if (!tabActive) {
            Modifier
        } else {
            Modifier.onGloballyPositioned { coords ->
                // Scrolled or clipped fully off screen, the bounds collapse to
                // nothing: treat that as "not on screen", not a spot at 0,0.
                val bounds = coords.boundsInRoot()
                val registry = CoachTargetRegistry.current?.targets
                if (bounds.width > 0f && bounds.height > 0f) registry?.put(id, bounds) else registry?.remove(id)
            }
        }
    }

// Modifier.onGloballyPositioned can't read a CompositionLocal, so the host
// publishes its controller here while it is composed.
internal object CoachTargetRegistry {
    var current: CoachMarkController? = null
}

/**
 * Wraps the whole app: provides the controller and draws the active tour over
 * everything (tab bar included) -- the screen dims, the control gets a glowing
 * cut-out, and a tip card with an arrow sits next to it.
 */
@Composable
fun CoachMarkHost(content: @Composable () -> Unit) {
    val controller = remember { CoachMarkController() }
    CoachTargetRegistry.current = controller
    CompositionLocalProvider(LocalCoachMarks provides controller) {
        Box(Modifier.fillMaxSize()) {
            content()
            val tour = controller.tour
            // Back ends the tour (and marks it seen) instead of acting on the screen underneath.
            BackHandler(enabled = tour != null && !controller.suspended) { controller.finish() }
            AnimatedVisibility(visible = tour != null && !controller.suspended, enter = fadeIn(), exit = fadeOut()) {
                if (tour != null) {
                    val step = tour.steps[controller.index.coerceIn(0, tour.steps.lastIndex)]
                    val target = controller.targets[step.targetId]
                    // A control on a tab that just opened may need a moment to
                    // lay out. If it still isn't there (no alerts yet), the card
                    // shows on its own, centered, so Next and Skip are always
                    // reachable. It used to skip ahead by itself, leaving a dimmed
                    // screen with no buttons in between -- Next looked broken.
                    var waited by remember(step) { mutableStateOf(false) }
                    LaunchedEffect(step) {
                        delay(MISSING_TARGET_WAIT_MS)
                        waited = true
                    }
                    CoachOverlay(
                        target = target,
                        showUnanchored = waited,
                        step = step,
                        position = controller.index,
                        total = tour.steps.size,
                        onNext = controller::next,
                        onSkip = controller::finish,
                    )
                }
            }
        }
    }
}

/**
 * Starts [tour] once per phone (until Settings → Replay tutorial) as soon as
 * this screen is laid out and nothing else is showing.
 */
@Composable
fun CoachTourLauncher(
    tour: CoachTour,
    enabled: Boolean = true,
) {
    val controller = LocalCoachMarks.current ?: return
    val prefs = LocalContext.current.container.userPreferences
    val scope = rememberCoroutineScope()
    // The steps can change after the launch is scheduled (a setting that loads
    // a moment later); start with the latest ones, not the first composed.
    val currentTour by rememberUpdatedState(tour)
    LaunchedEffect(tour.key, enabled, controller.suspended) {
        if (!enabled || controller.suspended) return@LaunchedEffect
        if (tour.key in prefs.tutorialsSeen.first()) return@LaunchedEffect
        // Let the screen finish laying out so every target has reported in.
        delay(TOUR_START_DELAY_MS)
        val latest = currentTour
        controller.start(latest) { scope.launch { prefs.markTutorialSeen(latest.key) } }
    }
}

private const val TOUR_START_DELAY_MS = 700L
private const val MISSING_TARGET_WAIT_MS = 900L
private const val MOVE_MS = 350
private const val DIM_ALPHA = 0.66f
private const val GLOW_ALPHA = 0.35f
private val SPOTLIGHT_PADDING = 8.dp
private val SCREEN_EDGE = 4.dp
private val ARROW_SIZE = 9.dp
private val PILL_MAX_HEIGHT = 80.dp
private val CARD_CORNER = 14.dp

@Composable
@Suppress("LongParameterList", "LongMethod", "CyclomaticComplexMethod") // one overlay: spotlight, arrow and tip card
private fun CoachOverlay(
    target: Rect?,
    showUnanchored: Boolean,
    step: CoachStep,
    position: Int,
    total: Int,
    onNext: () -> Unit,
    onSkip: () -> Unit,
) {
    val density = LocalDensity.current
    val pad = with(density) { SPOTLIGHT_PADDING.toPx() }
    val arrow = with(density) { ARROW_SIZE.toPx() }
    val tipColor = SurfaceElevated
    val safeTop = WindowInsets.systemBars.getTop(density).toFloat()
    val safeBottom = WindowInsets.systemBars.getBottom(density).toFloat()
    val edge = with(density) { SCREEN_EDGE.toPx() }
    BoxWithConstraints(
        Modifier
            .fillMaxSize()
            // Swallows taps so the app underneath can't be used mid-tour.
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = {},
            ),
    ) {
        val screenH = with(density) { maxHeight.toPx() }
        val screenW = with(density) { maxWidth.toPx() }
        // Padded around the control, but never past the screen edge (a
        // full-width row or a title near the edge used to get its ring cut off).
        val spotTarget = target?.let { paddedOnScreen(it, pad, edge, screenW, screenH) }
        // The spotlight glides from one control to the next instead of jumping.
        // The first spot of a tour appears in place: animating it from
        // Rect.Zero swept a ring in from the top-left corner. While the next
        // control lays out, the last spot is held.
        val spotAnim = remember { Animatable(Rect.Zero, Rect.VectorConverter) }
        LaunchedEffect(spotTarget) {
            if (spotTarget == null) return@LaunchedEffect
            if (spotAnim.value == Rect.Zero) {
                spotAnim.snapTo(spotTarget)
            } else {
                spotAnim.animateTo(spotTarget, tween(MOVE_MS))
            }
        }
        val spot = spotAnim.value
        val shown = spotTarget != null && spot != Rect.Zero
        val minTipY = safeTop + edge
        // Card below the control when it's in the top half, above otherwise.
        val below = !shown || spot.center.y < screenH / 2
        var tipSize by remember { mutableStateOf(IntSize.Zero) }
        val glow = Indigo
        Canvas(Modifier.fillMaxSize().graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }) {
            drawRect(Color.Black.copy(alpha = DIM_ALPHA))
            if (shown) {
                drawSpotlight(spot, glow)
                drawPath(arrowPath(spot, below, arrow, screenW), tipColor)
            }
        }
        if (shown) {
            // Kept between the status and navigation bars, so a tall card
            // (small phone, large text) is never pushed off screen.
            val tipTarget =
                tipTop(spot, below, arrow * ARROW_BASE, tipSize.height.toFloat())
                    .coerceIn(minTipY, maxOf(minTipY, screenH - safeBottom - edge - tipSize.height))
            // Same as the spot: placed on first show (it used to slide down from
            // the top of the screen), animated between steps.
            val tipAnim = remember { Animatable(Float.NaN) }
            LaunchedEffect(tipTarget, tipSize) {
                if (tipSize == IntSize.Zero || tipAnim.value.isNaN()) {
                    tipAnim.snapTo(tipTarget)
                } else {
                    tipAnim.animateTo(tipTarget, tween(MOVE_MS))
                }
            }
            val tipY = if (tipAnim.value.isNaN()) tipTarget else tipAnim.value
            CoachTipCard(
                step = step,
                position = position,
                total = total,
                onNext = onNext,
                onSkip = onSkip,
                modifier =
                    Modifier
                        .offset { IntOffset(0, tipY.roundToInt()) }
                        .padding(horizontal = 20.dp)
                        .onSizeChanged { tipSize = it },
            )
        } else if (showUnanchored) {
            CoachTipCard(
                step = step,
                position = position,
                total = total,
                onNext = onNext,
                onSkip = onSkip,
                modifier =
                    Modifier
                        .align(Alignment.Center)
                        .padding(horizontal = 20.dp),
            )
        }
    }
}

// The cut-out, plus a soft indigo glow and a thin white ring so the lit
// control reads as "this one" against the dimmed screen.
private fun DrawScope.drawSpotlight(
    spot: Rect,
    glow: Color,
) {
    val corner =
        if (spot.height < PILL_MAX_HEIGHT.toPx()) CornerRadius(spot.height / 2) else CornerRadius(CARD_CORNER.toPx())
    val size = Size(spot.width, spot.height)
    drawRoundRect(Color.Transparent, spot.topLeft, size, corner, blendMode = BlendMode.Clear)
    drawRoundRect(glow.copy(alpha = GLOW_ALPHA), spot.topLeft, size, corner, style = Stroke(6.dp.toPx()))
    drawRoundRect(Color.White, spot.topLeft, size, corner, style = Stroke(1.5.dp.toPx()))
}

@Composable
@Suppress("LongParameterList") // the step, where it is in the tour, and its two buttons
private fun CoachTipCard(
    step: CoachStep,
    position: Int,
    total: Int,
    onNext: () -> Unit,
    onSkip: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val last = position >= total - 1
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .shadow(16.dp, BantaiShapes.Large)
                .background(SurfaceElevated, BantaiShapes.Large)
                .padding(start = 18.dp, end = 18.dp, top = 16.dp, bottom = 12.dp),
    ) {
        Text(
            stringResource(step.title),
            color = White,
            fontSize = TextSize.Headline,
            fontWeight = FontWeight.SemiBold,
        )
        Spacer(Modifier.height(4.dp))
        Text(stringResource(step.body), color = TextSecondary, fontSize = TextSize.Subhead, lineHeight = 20.sp)
        Spacer(Modifier.height(14.dp))
        // The buttons are measured first and never wrap; the progress takes
        // what's left. On a narrow phone (Huawei) a long tour's dots used to
        // squeeze the pill until "Next" broke into "Ne / xt".
        Row(verticalAlignment = Alignment.CenterVertically) {
            StepProgress(position, total, Modifier.weight(1f))
            if (!last) {
                Text(
                    stringResource(R.string.coach_skip),
                    color = TextSecondary,
                    fontSize = TextSize.Subhead,
                    maxLines = 1,
                    softWrap = false,
                    modifier = Modifier.clickable(onClick = onSkip).padding(horizontal = 12.dp, vertical = 8.dp),
                )
            }
            Box(
                modifier =
                    Modifier
                        .background(Indigo, BantaiShapes.Pill)
                        .clickable(onClick = onNext)
                        .padding(horizontal = 20.dp, vertical = 9.dp),
            ) {
                Text(
                    stringResource(if (last) R.string.coach_done else R.string.coach_next),
                    color = OnIndigo,
                    fontSize = TextSize.Subhead,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    softWrap = false,
                )
            }
        }
    }
}

// Page dots like iOS onboarding, or "3 of 12" when a long tour's dots
// wouldn't fit beside the buttons.
@Composable
private fun StepProgress(
    position: Int,
    total: Int,
    modifier: Modifier = Modifier,
) {
    BoxWithConstraints(modifier) {
        val dotsWidth = 16.dp + 6.dp * (total - 1) + 5.dp * (total - 1)
        if (dotsWidth <= maxWidth) {
            StepDots(position, total)
        } else {
            Text(
                stringResource(R.string.coach_step_of, position + 1, total),
                color = TextSecondary,
                fontSize = TextSize.Footnote,
                maxLines = 1,
            )
        }
    }
}

// The current step is a longer indigo pill.
@Composable
private fun StepDots(
    position: Int,
    total: Int,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
        repeat(total) { i ->
            Box(
                Modifier
                    .height(6.dp)
                    .width(if (i == position) 16.dp else 6.dp)
                    .background(if (i == position) Indigo else TextTertiary, CircleShape),
            )
        }
    }
}

// The control's rect grown by [pad], kept [edge] inside the screen.
private fun paddedOnScreen(
    r: Rect,
    pad: Float,
    edge: Float,
    screenW: Float,
    screenH: Float,
) = Rect(
    (r.left - pad).coerceAtLeast(edge),
    (r.top - pad).coerceAtLeast(edge),
    (r.right + pad).coerceAtMost(screenW - edge),
    (r.bottom + pad).coerceAtMost(screenH - edge),
)

// Where the card's top goes: just under the spot, or just above it.
private fun tipTop(
    spot: Rect,
    below: Boolean,
    gap: Float,
    tipHeight: Float,
) = if (below) spot.bottom + gap else spot.top - gap - tipHeight

// Arrow geometry, in arrow-sizes: its point sits just off the spotlight and
// its base meets the tip card; it never runs closer than 3 to a screen edge.
private const val ARROW_POINT = 0.6f
private const val ARROW_BASE = 1.7f
private const val ARROW_EDGE_MARGIN = 3f

private fun arrowPath(
    spot: Rect,
    below: Boolean,
    arrow: Float,
    screenW: Float,
): Path {
    val x = spot.center.x.coerceIn(arrow * ARROW_EDGE_MARGIN, screenW - arrow * ARROW_EDGE_MARGIN)
    val dir = if (below) 1f else -1f
    val edge = if (below) spot.bottom else spot.top
    return Path().apply {
        moveTo(x, edge + dir * arrow * ARROW_POINT)
        lineTo(x - arrow, edge + dir * arrow * ARROW_BASE)
        lineTo(x + arrow, edge + dir * arrow * ARROW_BASE)
        close()
    }
}
