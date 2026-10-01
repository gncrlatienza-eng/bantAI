package com.bantai.mms

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Telephony
import android.util.Log
import com.bantai.data.db.BantaiDatabase
import com.bantai.data.db.PendingMmsEntity
import com.bantai.data.model.MmsDownloadState
import com.bantai.mms.pdu.NotificationInd
import com.bantai.mms.pdu.NotifyRespInd
import com.bantai.mms.pdu.PduComposer
import com.bantai.mms.pdu.PduHeaders
import com.bantai.receiver.MmsDownloadedReceiver
import com.bantai.util.SmsSender
import java.io.File

private const val TAG = "MmsDownloader"
private const val MILLIS_PER_SECOND = 1000L

// A download the phone never reported back on (the MMS service died, the phone
// rebooted mid-download) is shown as failed after this, so it can be retried.
private const val STALE_DOWNLOAD_MS = 5 * 60 * 1000L

// Temporary PDU files older than this are left over from an earlier download or
// acknowledgement and are removed.
private const val STALE_FILE_MS = 60 * 60 * 1000L

/**
 * Fetches incoming MMS from the carrier. The carrier's WAP push only announces
 * an MMS (who, how big, where); the message itself has to be downloaded over
 * mobile data. As the default SMS app nobody else does this, so every picture
 * and group message used to be lost. Flow: WapPushReceiver → [enqueue] →
 * SmsManager.downloadMultimediaMessage → MmsDownloadedReceiver → MmsPersister.
 *
 * Every call here does disk/Room work: call it off the main thread.
 */
class MmsDownloader(
    private val appContext: Context,
) {
    private val dao by lazy { BantaiDatabase.get(appContext).pendingMms() }

    /** Records a carrier notification and starts the download; false for a repeat. */
    fun enqueue(
        notification: NotificationInd,
        subId: Int,
        receivedAt: Long,
    ): Boolean {
        val location = notification.contentLocation?.let { String(it, Charsets.ISO_8859_1) } ?: return false
        val row =
            PendingMmsEntity(
                contentLocation = location,
                transactionId = notification.transactionId?.let { String(it, Charsets.ISO_8859_1) }.orEmpty(),
                sender = MmsParticipants.clean(notification.from?.string) ?: "Unknown",
                subId = subId,
                sizeBytes = notification.messageSize,
                expiresAt = expiryMillis(notification.expiry, receivedAt),
                receivedAt = receivedAt,
            )
        val id = dao.insert(row)
        if (id < 0) {
            Log.i(TAG, "Carrier repeated an MMS notification; already handled")
            return false
        }
        start(row.copy(id = id))
        return true
    }

    /** "Tap to download": tries a failed download again. */
    fun retry(pendingId: Long) {
        val row = dao.get(pendingId) ?: return
        if (effectiveState(row, System.currentTimeMillis()) == MmsDownloadState.EXPIRED) {
            dao.setState(pendingId, PendingMmsEntity.EXPIRED)
            notifyChanged()
            return
        }
        dao.startRetry(pendingId, System.currentTimeMillis())
        start(row)
    }

    fun get(pendingId: Long): PendingMmsEntity? = dao.get(pendingId)

    fun all(): List<PendingMmsEntity> = runCatching { dao.all() }.getOrDefault(emptyList())

    fun markFailed(pendingId: Long) {
        dao.setState(pendingId, PendingMmsEntity.FAILED)
        notifyChanged()
    }

    /** The MMS is saved to the phone's message store; the placeholder goes. */
    fun complete(pendingId: Long) {
        dao.delete(listOf(pendingId))
        notifyChanged()
    }

    fun delete(pendingIds: Collection<Long>) {
        if (pendingIds.isEmpty()) return
        dao.delete(pendingIds.toList())
        notifyChanged()
    }

    /**
     * Tells the carrier the MMS arrived (m-notifyresp-ind). Without it some
     * carriers keep re-sending the notification. Best effort: a failure here
     * doesn't affect the message, which is already saved.
     */
    fun acknowledge(
        transactionId: String,
        subId: Int,
    ) {
        if (transactionId.isEmpty()) return
        runCatching {
            val ack =
                NotifyRespInd(
                    PduHeaders.CURRENT_MMS_VERSION,
                    transactionId.toByteArray(Charsets.ISO_8859_1),
                    PduHeaders.STATUS_RETRIEVED,
                )
            val bytes = PduComposer(appContext, ack).make() ?: error("Couldn't encode the acknowledgement")
            val uri = MmsFileProvider.newUri(appContext)
            appContext.contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
            SmsSender.smsManagerFor(appContext, subId).sendMultimediaMessage(appContext, uri, null, null, null)
        }.onFailure { Log.w(TAG, "Couldn't acknowledge MMS to the carrier", it) }
    }

    private fun start(row: PendingMmsEntity) {
        cleanUpOldFiles()
        val uri = MmsFileProvider.newUri(appContext)
        val intent =
            Intent(appContext, MmsDownloadedReceiver::class.java)
                .putExtra(MmsDownloadedReceiver.EXTRA_PENDING_ID, row.id)
                .putExtra(MmsDownloadedReceiver.EXTRA_FILE_URI, uri.toString())
        // Mutable: the MMS service adds the result details to this intent.
        // Safe because the intent is explicit (our own receiver only).
        val flags =
            PendingIntent.FLAG_UPDATE_CURRENT or
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
        val resultIntent = PendingIntent.getBroadcast(appContext, row.id.toInt(), intent, flags)
        runCatching {
            SmsSender
                .smsManagerFor(appContext, row.subId)
                .downloadMultimediaMessage(appContext, row.contentLocation, uri, null, resultIntent)
        }.onSuccess {
            notifyChanged()
        }.onFailure {
            Log.w(TAG, "The phone refused to start an MMS download", it)
            MmsFileProvider.delete(appContext, uri)
            markFailed(row.id)
        }
    }

    // Both lists (inbox and thread) watch the MMS store, so a change here redraws them.
    private fun notifyChanged() {
        appContext.contentResolver.notifyChange(Telephony.Mms.CONTENT_URI, null)
    }

    private fun cleanUpOldFiles() {
        val cutoff = System.currentTimeMillis() - STALE_FILE_MS
        File(appContext.cacheDir, "mms").listFiles()?.filter { it.lastModified() < cutoff }?.forEach { it.delete() }
    }

    companion object {
        /**
         * What the placeholder bubble should show. A download that never
         * reported back counts as failed, and one past the carrier's expiry as
         * expired -- the carrier has deleted it, so a retry can't succeed.
         */
        fun effectiveState(
            row: PendingMmsEntity,
            now: Long,
        ): MmsDownloadState {
            val expired = row.expiresAt in 1..<now
            return when {
                row.state == PendingMmsEntity.EXPIRED -> MmsDownloadState.EXPIRED
                row.state == PendingMmsEntity.DOWNLOADING && now - row.attemptedAt < STALE_DOWNLOAD_MS ->
                    MmsDownloadState.DOWNLOADING
                expired -> MmsDownloadState.EXPIRED
                else -> MmsDownloadState.FAILED
            }
        }

        /**
         * The notification's expiry in millis, or 0 when it didn't give one.
         * PduParser already turns a relative expiry into an absolute time;
         * a value below a year is still taken as seconds-from-now in case a
         * PDU slips through unconverted.
         */
        fun expiryMillis(
            expiry: Long,
            receivedAt: Long,
        ): Long =
            when {
                expiry <= 0 -> 0
                expiry < RELATIVE_EXPIRY_LIMIT_S -> receivedAt + expiry * MILLIS_PER_SECOND
                else -> expiry * MILLIS_PER_SECOND
            }

        private const val RELATIVE_EXPIRY_LIMIT_S = 365L * 24 * 60 * 60

        fun uriFrom(extra: String?): Uri? = extra?.let(Uri::parse)
    }
}
