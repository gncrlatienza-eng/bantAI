package com.bantai.data.local

import android.content.Context
import com.bantai.data.model.normalizeSenderKey

/**
 * Senders blocked only because the user reported them as a scam (Take
 * Action's auto-block), not because they chose Block themselves. If the
 * BantAI team rejects that report, ReportStatusWorker lifts exactly these
 * blocks; a block the user picked on purpose is never undone for them.
 */
object ReportBlocks {
    private const val PREFS = "report_blocks"
    private const val KEY = "senders"

    fun mark(
        context: Context,
        sender: String,
    ) = update(context) { it + normalizeSenderKey(sender) }

    /** True (and forgets it) when [sender]'s block came from a scam report. */
    @Synchronized
    fun consume(
        context: Context,
        sender: String,
    ): Boolean {
        val key = normalizeSenderKey(sender)
        if (key !in current(context)) return false
        update(context) { it - key }
        return true
    }

    /** The user unblocked or re-blocked on their own: it's their block now. */
    fun forget(
        context: Context,
        sender: String,
    ) = update(context) { it - normalizeSenderKey(sender) }

    private fun current(context: Context): Set<String> =
        context
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getStringSet(KEY, emptySet())
            .orEmpty()

    /** A different account signed in: its reports never blocked anyone here. */
    fun clear(context: Context) =
        synchronized(this) {
            context
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .clear()
                .apply()
        }

    @Synchronized
    private fun update(
        context: Context,
        change: (Set<String>) -> Set<String>,
    ) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.edit().putStringSet(KEY, change(current(context)).toSet()).apply()
    }
}
