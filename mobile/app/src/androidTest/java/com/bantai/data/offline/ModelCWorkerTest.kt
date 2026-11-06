package com.bantai.data.offline

import android.Manifest
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.provider.Telephony
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.WorkInfo
import androidx.work.WorkManager
import com.bantai.container
import com.bantai.data.local.LocalMessageStore
import com.bantai.data.model.Classification
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.TimeUnit

/** Exercises actual durable WorkManager classification of a locally stored SMS offline. */
@RunWith(AndroidJUnit4::class)
class ModelCWorkerTest {
    @Test
    fun durableWorkerClassifiesNegativeLocalMessageIdWithoutNetwork() =
        runBlocking {
            val context = InstrumentationRegistry.getInstrumentation().targetContext
            assertEquals(
                "Grant READ_SMS in the isolated QA emulator before this test",
                PackageManager.PERMISSION_GRANTED,
                context.checkSelfPermission(Manifest.permission.READ_SMS),
            )
            assertNull(context.getSystemService(ConnectivityManager::class.java).activeNetwork)
            val localStore = LocalMessageStore.get(context)
            val manifest =
                context.assets
                    .open("model_c/manifest.json")
                    .bufferedReader()
                    .use { JSONObject(it.readText()) }
            val store = context.container.classificationStore
            val messageId =
                withContext(Dispatchers.IO) {
                    localStore.insert(
                        address = "+639170000000",
                        body = "Kumusta po! Magkita tayo bukas.",
                        date = System.currentTimeMillis(),
                        type = Telephony.Sms.MESSAGE_TYPE_INBOX,
                        read = false,
                        subId = -1,
                    )
                }
            assertTrue("Local SMS fallback uses negative identifiers", messageId < 0)
            val workManager = WorkManager.getInstance(context)
            val workName = "model-c-message-$messageId"
            try {
                ModelCClassificationWorker.enqueue(context, messageId)
                var state: WorkInfo.State? = null
                for (attempt in 0 until 120) {
                    state =
                        withContext(Dispatchers.IO) {
                            workManager
                                .getWorkInfosForUniqueWork(workName)
                                .get(5, TimeUnit.SECONDS)
                                .firstOrNull()
                                ?.state
                        }
                    if (state?.isFinished == true) break
                    delay(1000)
                }
                assertEquals("Durable local inference must finish successfully", WorkInfo.State.SUCCEEDED, state)
                assertEquals(Classification.SAFE, store.snapshotFor(messageId))
                val provenance = store.provenanceFor(messageId)
                assertEquals("on_device_model_c", provenance?.source)
                assertEquals(manifest.getString("model_version"), provenance?.modelVersion)
                assertEquals(
                    manifest.getString("model_sha256"),
                    provenance?.modelSha256,
                )
                assertNull(context.getSystemService(ConnectivityManager::class.java).activeNetwork)
            } finally {
                withContext(Dispatchers.IO) {
                    workManager.cancelUniqueWork(workName).result.get(5, TimeUnit.SECONDS)
                    localStore.delete(listOf(messageId))
                }
                store.remove(listOf(messageId))
            }
        }
}
