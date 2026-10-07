package com.bantai.data.offline

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.bantai.container
import com.bantai.data.SmsIngestPipeline
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private const val TAG = "ModelCWorker"
private const val MESSAGE_ID = "message_id"

/** Durable follow-up after the receiver's short deadline; raw SMS is never put in WorkManager data. */
class ModelCClassificationWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
    @Suppress("ReturnCount")
    // Invalid input, deleted source SMS, and inference outcome are distinct WorkManager states.
    override suspend fun doWork(): Result {
        val messageId = inputData.getLong(MESSAGE_ID, Long.MIN_VALUE)
        if (messageId == Long.MIN_VALUE) return Result.failure()
        val message =
            withContext(Dispatchers.IO) {
                applicationContext.container.smsRepository.getMessageById(messageId)
            } ?: return Result.success()
        return runCatching {
            val result = ModelCRuntime.classify(applicationContext, message.body)
            SmsIngestPipeline.applyOnDeviceModelResult(applicationContext, message, result)
            Result.success()
        }.getOrElse { error ->
            Log.e(TAG, "Local Model C classification failed for message $messageId; heuristic remains", error)
            Result.failure(Data.Builder().putString("reason", error.javaClass.simpleName).build())
        }
    }

    companion object {
        fun enqueue(
            context: Context,
            messageId: Long?,
        ) {
            if (messageId == null) return
            val request =
                OneTimeWorkRequestBuilder<ModelCClassificationWorker>()
                    .setInputData(Data.Builder().putLong(MESSAGE_ID, messageId).build())
                    .addTag("model-c-local")
                    .build()
            WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(
                "model-c-message-$messageId",
                ExistingWorkPolicy.KEEP,
                request,
            )
        }
    }
}
