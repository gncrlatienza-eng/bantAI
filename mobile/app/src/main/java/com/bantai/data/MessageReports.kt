package com.bantai.data

import android.content.Context
import com.bantai.R
import com.bantai.container
import com.bantai.data.model.Classification
import com.bantai.data.remote.ApiException
import com.bantai.data.remote.ReportsApi
import com.bantai.data.remote.VerificationApi
import com.bantai.util.SenderReplyKind
import com.bantai.util.replyKindFor
import kotlinx.coroutines.flow.first
import java.util.UUID

/**
 * Filing a user's correction (Ham/Spam/Scam) for one or more messages, shared
 * by Take Action and the thread's quick "It's a real message / It's spam"
 * buttons. Reports feed AI retraining and admin review (POST /reports).
 */
object MessageReports {
    /** One message to report: its backend id when known, else the device row to resolve (or register) it from. */
    data class Target(
        val messageId: String,
        val localMessageId: Long?,
    )

    /**
     * Files [reportedLabel] for every target. Several targets share one
     * groupId so they're listed as one report. Every message is attempted even
     * if one fails, so a flaky connection doesn't leave the rest unreported; the
     * first real failure is returned. One already reported among new ones is
     * fine; all of them already reported says so, as a single report always has.
     * A successful report also re-files the message on the phone ([refile]).
     */
    @Suppress("LongParameterList") // one report's fields; notes/blocked default for quick flags
    suspend fun submit(
        context: Context,
        sender: String,
        reportedLabel: String,
        targets: List<Target>,
        notes: String = "",
        blocked: Boolean = false,
    ): Result<Unit> {
        val token =
            context.container.userPreferences.userData
                .first()
                .authToken
        if (token.isEmpty()) return Result.failure(Exception(context.getString(R.string.take_action_error_sign_in)))
        val groupId = if (targets.size > 1) UUID.randomUUID().toString() else null
        val results = targets.map { submitOne(context, token, it, reportedLabel, notes, groupId, blocked) }
        if (results.any { it.isSuccess } && reportedLabel == "Scam") fileSenderReport(token, sender)
        val failures = results.filter { it.isFailure }
        return when {
            failures.isEmpty() -> Result.success(Unit)
            failures.size == results.size -> failures.first()
            else -> failures.firstOrNull { !it.isAlreadyReported() } ?: Result.success(Unit)
        }
    }

    fun Result<Unit>.isAlreadyReported(): Boolean = (exceptionOrNull() as? ApiException)?.status == HTTP_CONFLICT

    @Suppress("LongParameterList")
    private suspend fun submitOne(
        context: Context,
        token: String,
        target: Target,
        reportedLabel: String,
        notes: String,
        groupId: String?,
        blocked: Boolean,
    ): Result<Unit> {
        // A message the backend hasn't seen yet (never scanned, or never flagged) is
        // registered on the spot rather than making Report unavailable for it.
        val messageId =
            target.messageId.ifBlank {
                target.localMessageId?.let { SmsIngestPipeline.backendMessageIdFor(context, token, it) }.orEmpty()
            }
        if (messageId.isBlank()) {
            // Say so instead of silently no-opping into a "submitted" confirmation screen.
            return Result.failure(Exception(context.getString(R.string.take_action_error_offline)))
        }
        val submitted = ReportsApi.submit(token, messageId, reportedLabel, notes, groupId)
        // Filed now, or already filed before (the backend allows one per message):
        // either way the alert belongs under Reported, where Report isn't offered.
        if (submitted.isSuccess || submitted.isAlreadyReported()) {
            val store = context.container.alertStateStore
            store.markReported(messageId, reportedLabel)
            target.localMessageId?.let { store.markReportedLocal(mapOf(it to reportedLabel)) }
        }
        if (submitted.isSuccess) refile(context, target.localMessageId, reportedLabel, blocked)
        return submitted
    }

    /**
     * Moves the reported message to the chip the user chose, right away -- a report
     * used to change nothing on the phone, so a scam reported from Messages stayed
     * in Messages. Ham -> Messages, Spam -> Spam. Scam -> Scam once its sender is
     * [blocked] (the report blocks it): the thread leaves the inbox and the
     * report is under Alerts -> Reported. A scam report that couldn't block (a
     * trusted sender name, or BantAI isn't the default SMS app) goes to Unknown
     * instead, since a scam label hides the thread from every chip. A message
     * already filed as a scam (an alert) stays one.
     */
    suspend fun refile(
        context: Context,
        localMessageId: Long?,
        reportedLabel: String,
        blocked: Boolean = false,
    ) {
        if (localMessageId == null || localMessageId <= 0) return
        val store = context.container.classificationStore
        val current = store.snapshotFor(localMessageId)
        val label =
            when {
                reportedLabel == "Ham" -> Classification.SAFE
                reportedLabel == "Spam" -> Classification.SPAM
                current == Classification.SCAM -> return
                blocked -> Classification.SCAM
                else -> Classification.UNKNOWN
            }
        store.setClassification(localMessageId, label)
    }

    // Corroborating evidence so several users reporting the same number can get it
    // confirmed as fraud for everyone. Only real phone numbers: brand sender IDs
    // ("BPI", "GCash") are routinely spoofed, so flagging the ID would flag every
    // genuine message from that brand. Best-effort -- the message report already
    // succeeded, and a repeat report of the same sender (409) is expected.
    private suspend fun fileSenderReport(
        token: String,
        sender: String,
    ) {
        if (replyKindFor(sender) != SenderReplyKind.PHONE_NUMBER) return
        VerificationApi.reportSender(token, sender)
    }

    private const val HTTP_CONFLICT = 409
}
