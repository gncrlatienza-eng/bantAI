package com.bantai.ui.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PagerState
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.work.WorkManager
import com.bantai.R
import com.bantai.container
import com.bantai.data.offline.HistorySortWorker
import com.bantai.ui.components.BantAILogo
import com.bantai.ui.components.PrimaryButton
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.OnIndigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// (title, body) pairs for the tutorial cards shown while sorting runs.
private val tutorialCards =
    listOf(
        R.string.setup_card_tabs_title to R.string.setup_card_tabs_body,
        R.string.setup_card_alerts_title to R.string.setup_card_alerts_body,
        R.string.setup_card_report_title to R.string.setup_card_report_body,
        R.string.setup_card_privacy_title to R.string.setup_card_privacy_body,
    )

// With no progress for this long, offer a way in rather than trap the user.
private const val STALL_MS = 90_000L
private const val STALL_CHECK_MS = 5_000L
private const val ESTIMATE_MIN_DONE = 10
private const val MS_PER_SECOND = 1000
private const val SECONDS_PER_MINUTE = 60

/** What the Setup screen shows about the first-run sort. */
private data class SortProgress(
    val ready: Boolean,
    val done: Int,
    val total: Int,
    val remainingSeconds: Int?,
    val stalled: Boolean,
)

/**
 * First-run setup (tester feedback, 2026-10-14). The app used to open on tabs
 * that were still being sorted, with nothing saying so, so people judged it
 * or acted on half-sorted lists. This screen stays up until the recent texts
 * are sorted (HistorySortWorker), shows real progress, and teaches the app
 * with a few cards meanwhile. After it, sorted messages don't move.
 */
@Composable
fun SetupScreen(onDone: () -> Unit) {
    val progress = rememberSortProgress()
    val pager = rememberPagerState { tutorialCards.size + 1 }
    val scope = rememberCoroutineScope()

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Black)
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp),
    ) {
        SetupHeader(progress)
        Spacer(Modifier.height(24.dp))
        TutorialPager(pager, Modifier.weight(1f))
        when {
            progress.ready -> PrimaryButton(text = stringResource(R.string.setup_open), onClick = onDone)
            pager.currentPage < tutorialCards.size ->
                PrimaryButton(
                    text = stringResource(R.string.setup_next_tip),
                    onClick = { scope.launch { pager.animateScrollToPage(pager.currentPage + 1) } },
                )
            else -> PrimaryButton(text = stringResource(R.string.setup_open), onClick = {}, enabled = false)
        }
        if (!progress.ready && progress.stalled) {
            TextButton(onClick = onDone, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.setup_continue_anyway), color = TextSecondary)
            }
        }
        Spacer(Modifier.height(16.dp))
    }
}

@Composable
private fun rememberSortProgress(): SortProgress {
    val context = LocalContext.current
    val sortedAt by context.container.userPreferences.historySortedAt
        .collectAsState(initial = 0L)
    val workInfos by WorkManager
        .getInstance(context)
        .getWorkInfosForUniqueWorkFlow(HistorySortWorker.UNIQUE_NAME)
        .collectAsState(initial = emptyList())
    LaunchedEffect(Unit) { HistorySortWorker.enqueue(context) }

    val info = workInfos.firstOrNull()
    val data = info?.progress
    val done = data?.getInt(HistorySortWorker.KEY_DONE, 0) ?: 0
    val total = data?.getInt(HistorySortWorker.KEY_TOTAL, 0) ?: 0
    // Finished (or the worker ended without saving, e.g. no model): let them in.
    val ready =
        sortedAt > 0L ||
            info?.state?.isFinished == true ||
            data?.getString(HistorySortWorker.KEY_PHASE) == HistorySortWorker.PHASE_OLDER

    // Time estimate from this run's own pace, and a stall fallback.
    var startedAt by remember { mutableLongStateOf(0L) }
    var lastProgressAt by remember { mutableLongStateOf(System.currentTimeMillis()) }
    var stalled by remember { mutableStateOf(false) }
    LaunchedEffect(done) {
        val now = System.currentTimeMillis()
        if (done > 0 && startedAt == 0L) startedAt = now
        lastProgressAt = now
        stalled = false
    }
    LaunchedEffect(ready) {
        while (!ready) {
            delay(STALL_CHECK_MS)
            if (System.currentTimeMillis() - lastProgressAt > STALL_MS) stalled = true
        }
    }
    return SortProgress(ready, done, total, remainingSeconds(startedAt, done, total), stalled)
}

private fun remainingSeconds(
    startedAt: Long,
    done: Int,
    total: Int,
): Int? {
    if (done < ESTIMATE_MIN_DONE || total <= done || startedAt == 0L) return null
    val perMessage = (System.currentTimeMillis() - startedAt).toDouble() / done
    return ((total - done) * perMessage / MS_PER_SECOND).toInt()
}

@Composable
private fun SetupHeader(progress: SortProgress) {
    Spacer(Modifier.height(40.dp))
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { BantAILogo(size = 56.dp) }
    Spacer(Modifier.height(20.dp))
    Text(
        stringResource(if (progress.ready) R.string.setup_title_ready else R.string.setup_title_sorting),
        color = White,
        fontWeight = FontWeight.Bold,
        fontSize = 26.sp,
        textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth(),
    )
    Spacer(Modifier.height(8.dp))
    Text(
        stringResource(if (progress.ready) R.string.setup_subtitle_ready else R.string.setup_subtitle_sorting),
        color = TextSecondary,
        fontSize = TextSize.Subhead,
        textAlign = TextAlign.Center,
        lineHeight = 19.sp,
        modifier = Modifier.fillMaxWidth(),
    )
    if (!progress.ready) {
        Spacer(Modifier.height(20.dp))
        ProgressBlock(progress)
    }
}

@Composable
private fun ProgressBlock(progress: SortProgress) {
    val barModifier = Modifier.fillMaxWidth().height(6.dp)
    if (progress.total > 0) {
        LinearProgressIndicator(
            progress = { progress.done.toFloat() / progress.total },
            color = Indigo,
            trackColor = SurfaceElevated,
            modifier = barModifier,
        )
    } else {
        LinearProgressIndicator(color = Indigo, trackColor = SurfaceElevated, modifier = barModifier)
    }
    Spacer(Modifier.height(8.dp))
    val eta = progress.remainingSeconds
    Text(
        when {
            progress.total == 0 -> stringResource(R.string.setup_progress_reading)
            eta != null ->
                pluralStringResource(
                    R.plurals.setup_progress_count_eta,
                    progress.total,
                    progress.done,
                    progress.total,
                    etaLabel(eta),
                )
            else -> pluralStringResource(R.plurals.setup_progress_count, progress.total, progress.done, progress.total)
        },
        color = TextSecondary,
        fontSize = TextSize.Footnote,
        textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun TutorialPager(
    pager: PagerState,
    modifier: Modifier,
) {
    HorizontalPager(state = pager, modifier = modifier.fillMaxWidth()) { page ->
        // Each card scrolls inside its page, so nothing (the last card's
        // switches) is cut off on a small screen or at a large font size.
        Box(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
            if (page == tutorialCards.size) {
                SimplerAppCard()
            } else {
                val (title, body) = tutorialCards[page]
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(Surface, RoundedCornerShape(16.dp))
                            .padding(20.dp),
                ) {
                    Text(stringResource(title), color = Indigo, fontWeight = FontWeight.Bold, fontSize = TextSize.Body)
                    Spacer(Modifier.height(8.dp))
                    Text(stringResource(body), color = White, fontSize = TextSize.Subhead, lineHeight = 21.sp)
                }
            }
        }
    }
    Row(
        Modifier.fillMaxWidth().padding(vertical = 12.dp),
        horizontalArrangement = Arrangement.Center,
    ) {
        repeat(tutorialCards.size + 1) { index ->
            Box(
                Modifier
                    .padding(horizontal = 4.dp)
                    .size(8.dp)
                    .background(if (index == pager.currentPage) Indigo else SurfaceElevated, CircleShape),
            )
        }
    }
}

@Composable
private fun etaLabel(seconds: Int): String =
    if (seconds < SECONDS_PER_MINUTE) {
        stringResource(R.string.setup_eta_seconds)
    } else {
        stringResource(R.string.setup_eta_minutes, (seconds + SECONDS_PER_MINUTE - 1) / SECONDS_PER_MINUTE)
    }

/**
 * The last Setup card: a new user can keep the app to its three main things
 * (Messages, Spam, Alerts) by hiding Unknown, and choose whether to show Scam
 * Waves. Both stay changeable in Settings → Appearance.
 */
@Composable
private fun SimplerAppCard() {
    val prefs = LocalContext.current.container.userPreferences
    val scope = rememberCoroutineScope()
    val showWaves by prefs.showScamWavesTab.collectAsState(initial = false)
    val hideUnknown by prefs.hideUnknown.collectAsState(initial = false)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(Surface, RoundedCornerShape(16.dp))
                .padding(20.dp),
    ) {
        Text(
            stringResource(R.string.setup_simpler_title),
            color = Indigo,
            fontWeight = FontWeight.Bold,
            fontSize = TextSize.Body,
        )
        Spacer(Modifier.height(6.dp))
        Text(
            stringResource(R.string.setup_simpler_body),
            color = White,
            fontSize = TextSize.Subhead,
            lineHeight = 21.sp,
        )
        Spacer(Modifier.height(14.dp))
        SetupSwitch(
            title = stringResource(R.string.setup_simpler_hide_unknown),
            detail = stringResource(R.string.setup_simpler_hide_unknown_detail),
            checked = !hideUnknown,
            onChange = { scope.launch { prefs.saveHideUnknown(!it) } },
        )
        Spacer(Modifier.height(10.dp))
        SetupSwitch(
            title = stringResource(R.string.setup_simpler_show_waves),
            detail = stringResource(R.string.setup_simpler_show_waves_detail),
            checked = showWaves,
            onChange = { scope.launch { prefs.saveShowScamWavesTab(it) } },
        )
    }
}

@Composable
private fun SetupSwitch(
    title: String,
    detail: String,
    checked: Boolean,
    onChange: (Boolean) -> Unit,
) {
    Row(
        modifier =
            Modifier.fillMaxWidth().toggleable(value = checked, role = Role.Switch, onValueChange = onChange),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, color = White, fontSize = TextSize.Body)
            Text(detail, color = TextSecondary, fontSize = TextSize.Footnote, lineHeight = 17.sp)
        }
        Spacer(Modifier.width(12.dp))
        Switch(
            checked = checked,
            onCheckedChange = null,
            colors = SwitchDefaults.colors(checkedThumbColor = OnIndigo, checkedTrackColor = Indigo),
        )
    }
}
