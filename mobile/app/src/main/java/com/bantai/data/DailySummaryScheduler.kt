package com.bantai.data

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.bantai.R
import com.bantai.container
import com.bantai.data.model.Classification
import com.bantai.data.model.SmsMessage
import com.bantai.util.SummaryNotification
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.concurrent.TimeUnit

/** What BantAI caught in the last day, for the evening recap. */
data class DailySummary(
    val scams: List<SmsMessage>,
    val spamCount: Int,
    val unknownCount: Int,
) {
    val isClear: Boolean get() = scams.isEmpty()

    companion object {
        /**
         * Incoming texts BantAI flagged today (since local midnight), by label.
         * It used to be the last 24 hours, so just after 12 it still showed
         * yesterday evening's scams as "caught today".
         */
        suspend fun load(
            context: Context,
            nowMillis: Long = System.currentTimeMillis(),
        ): DailySummary =
            withContext(Dispatchers.IO) {
                val container = context.container
                val since =
                    Instant
                        .ofEpochMilli(nowMillis)
                        .atZone(ZoneId.systemDefault())
                        .toLocalDate()
                        .atStartOfDay(ZoneId.systemDefault())
                        .toInstant()
                        .toEpochMilli()
                val ids = container.classificationStore.idsClassifiedSince(since)
                val deleted =
                    container.deletedMessagesStore.deletedEntries
                        .first()
                        .mapTo(HashSet()) { it.id }
                // getMessagesByIds applies read-time corrections (a trusted
                // sender's Scam reads as Unknown), so counts match the inbox.
                val recent =
                    if (ids.isEmpty()) {
                        emptyList()
                    } else {
                        container.smsRepository
                            .getMessagesByIds(ids - deleted)
                            .filter { !it.isOutgoing && it.timestamp >= since }
                    }
                DailySummary(
                    scams =
                        recent
                            .filter { it.classification == Classification.SCAM }
                            .sortedByDescending { it.timestamp },
                    spamCount = recent.count { it.classification == Classification.SPAM },
                    unknownCount = recent.count { it.classification == Classification.UNKNOWN },
                )
            }
    }
}

/**
 * Posts the evening recap once a day at the time picked in Settings ->
 * Notifications (8:00 PM by default): the scams and spam caught today, or that
 * the day was clear. Tapping it opens the summary card.
 *
 * An AlarmManager alarm, not WorkManager: Android (and Huawei's battery
 * manager especially) held the WorkManager job back while BantAI was closed,
 * so the recap only arrived when the app was next opened. An allow-while-idle
 * alarm fires at the set time even with the app closed; each firing arms the
 * next day's, and [DailySummaryBootReceiver] re-arms it after a reboot or update.
 */
object DailySummaryScheduler {
    private const val ACTION_FIRE = "com.bantai.action.DAILY_SUMMARY"
    private const val REQUEST_CODE = 0x5355_4D4D // "SUMM"

    // The WorkManager job earlier 1.7 builds used; cancelled so it can't post a second copy.
    private const val LEGACY_WORK = "daily-summary"

    // Catch-up safety nets for phones whose battery manager wipes the alarm
    // (Huawei EMUI, Xiaomi, Oppo): a 15-minute check, and one run per incoming text.
    private const val CATCH_UP_WORK = "daily-summary-catchup"
    private const val CATCH_UP_NOW = "daily-summary-catchup-now"
    private const val CATCH_UP_MINUTES = 15L

    // The day (epoch day) the recap was last shown, so the alarm, the catch-ups
    // and opening the app never show it twice.
    private const val PREFS = "daily_summary"
    private const val KEY_LAST_DAY = "last_shown_day"

    /** Arms (or, when switched off, cancels) the next recap. Safe to call any time. */
    suspend fun schedule(context: Context) {
        val prefs = context.container.userPreferences
        val work = WorkManager.getInstance(context)
        work.cancelUniqueWork(LEGACY_WORK)
        val alarms = context.getSystemService(AlarmManager::class.java) ?: return
        val pending = firePendingIntent(context)
        if (!prefs.dailySummaryEnabled.first()) {
            alarms.cancel(pending)
            work.cancelUniqueWork(CATCH_UP_WORK)
            return
        }
        work.enqueueUniquePeriodicWork(
            CATCH_UP_WORK,
            ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<DailySummaryCatchUpWorker>(CATCH_UP_MINUTES, TimeUnit.MINUTES).build(),
        )
        val now = ZonedDateTime.now()
        val trigger = now.plus(delayUntil(now, prefs.dailySummaryMinute.first())).toInstant().toEpochMilli()
        // Exact when Android allows it (always before 12; with "Alarms &
        // reminders" access after), otherwise within a few minutes of the time.
        val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()
        if (exact) {
            alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pending)
        } else {
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pending)
        }
    }

    /**
     * Posts today's recap if its time has passed and it hasn't been shown yet.
     * Called by the alarm and by every catch-up, so whichever runs first wins.
     */
    suspend fun postIfDue(context: Context) {
        // A recap Android would drop isn't claimed: opening the app then shows the card instead.
        if (!SummaryNotification.canPost(context)) return
        if (claimIfDue(context)) post(context)
    }

    /**
     * Marks today's recap as shown and returns true if it was due. Opening the
     * app uses this to show the card itself when no notification got through.
     */
    suspend fun claimIfDue(context: Context): Boolean = claimLock.withLock { claim(context) }

    // The alarm, the catch-ups and onResume can all run at once; without the
    // lock two of them could both see the recap as due and post it twice.
    private val claimLock = Mutex()

    @Suppress("ReturnCount") // off, not due yet, then claim
    private suspend fun claim(context: Context): Boolean {
        val prefs = context.container.userPreferences
        if (!prefs.dailySummaryEnabled.first()) return false
        val store = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val now = ZonedDateTime.now()
        if (!isDue(now, prefs.dailySummaryMinute.first(), store.getLong(KEY_LAST_DAY, Long.MIN_VALUE))) return false
        store.edit().putLong(KEY_LAST_DAY, now.toLocalDate().toEpochDay()).commit()
        return true
    }

    /** A text just arrived: the default SMS app is always woken for it, so catch up then. */
    fun onSmsReceived(context: Context) {
        WorkManager.getInstance(context).enqueueUniqueWork(
            CATCH_UP_NOW,
            ExistingWorkPolicy.KEEP,
            OneTimeWorkRequestBuilder<DailySummaryCatchUpWorker>().build(),
        )
    }

    /** Due once today's time has passed, until it has been shown today. */
    fun isDue(
        now: ZonedDateTime,
        minuteOfDay: Int,
        lastShownDay: Long,
    ): Boolean {
        val slot = now.toLocalDate().atStartOfDay(now.zone).plusMinutes(minuteOfDay.toLong())
        return !now.isBefore(slot) && lastShownDay != now.toLocalDate().toEpochDay()
    }

    /** Builds and posts today's recap notification. */
    private suspend fun post(context: Context) {
        val summary = DailySummary.load(context)
        val res = context.resources
        val title =
            if (summary.isClear) {
                context.getString(R.string.summary_notif_clear_title)
            } else {
                res.getQuantityString(R.plurals.summary_notif_scams_title, summary.scams.size, summary.scams.size)
            }
        val body =
            when {
                summary.spamCount > 0 ->
                    res.getQuantityString(R.plurals.summary_notif_spam_body, summary.spamCount, summary.spamCount)
                summary.isClear -> context.getString(R.string.summary_notif_clear_body)
                else -> context.getString(R.string.summary_notif_tap)
            }
        SummaryNotification.send(context, title, body)
    }

    internal fun isFire(intent: Intent?): Boolean = intent?.action == ACTION_FIRE

    private fun firePendingIntent(context: Context): PendingIntent =
        PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            Intent(context, DailySummaryAlarmReceiver::class.java).setAction(ACTION_FIRE),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    /** Time from [now] to the next [minuteOfDay] (today if still ahead, else tomorrow). */
    fun delayUntil(
        now: ZonedDateTime,
        minuteOfDay: Int,
    ): Duration {
        var next =
            now
                .toLocalDate()
                .atStartOfDay(now.zone)
                .plusMinutes(minuteOfDay.toLong())
        if (!next.isAfter(now)) next = next.plusDays(1)
        return Duration.between(now, next)
    }
}

/** The alarm going off: post the recap, then arm tomorrow's. Not exported. */
class DailySummaryAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(
        context: Context,
        intent: Intent?,
    ) {
        if (!DailySummaryScheduler.isFire(intent)) return
        val app = context.applicationContext
        val pending = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                DailySummaryScheduler.postIfDue(app)
                DailySummaryScheduler.schedule(app)
            } catch (
                @Suppress("TooGenericExceptionCaught") e: Exception,
            ) {
                // Never crash the app from the background over a recap.
                Log.w(TAG, "daily summary alarm failed", e)
            } finally {
                pending.finish()
            }
        }
    }
}

/**
 * Alarms are wiped by a reboot and by an app update: arm the recap again. Also
 * re-armed when exact-alarm access is granted (Android 12+), so it fires on time.
 */
class DailySummaryBootReceiver : BroadcastReceiver() {
    override fun onReceive(
        context: Context,
        intent: Intent?,
    ) {
        if (intent?.action !in REARM_ACTIONS) return
        val app = context.applicationContext
        val pending = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                DailySummaryScheduler.schedule(app)
            } catch (
                @Suppress("TooGenericExceptionCaught") e: Exception,
            ) {
                Log.w(TAG, "daily summary re-arm failed", e)
            } finally {
                pending.finish()
            }
        }
    }
}

private const val TAG = "DailySummary"

private val REARM_ACTIONS =
    setOf(
        Intent.ACTION_BOOT_COMPLETED,
        Intent.ACTION_MY_PACKAGE_REPLACED,
        // AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED (API 31); never sent below.
        "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED",
    )

/** The catch-up check: post the recap if it's due, and re-arm the alarm in case it was wiped. */
class DailySummaryCatchUpWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        DailySummaryScheduler.postIfDue(applicationContext)
        DailySummaryScheduler.schedule(applicationContext)
        return Result.success()
    }
}
