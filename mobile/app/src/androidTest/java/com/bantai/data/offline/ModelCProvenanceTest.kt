package com.bantai.data.offline

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.bantai.data.local.ClassificationStore
import com.bantai.data.model.Classification
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Real SQLite checks: local inference must not erase a newer cloud verdict. */
@RunWith(AndroidJUnit4::class)
class ModelCProvenanceTest {
    @Test
    fun cloudPrecedenceAndLocalIdentitySurviveConcurrentWrites() =
        runBlocking {
            val context = InstrumentationRegistry.getInstrumentation().targetContext
            val store = ClassificationStore(context)
            val localId = -900000001L
            val racedId = -900000002L
            val modelHash = "2478923ccdb9fc9db9de0644f3eb3eb8cc7e4f6421a1b222dbae84b3b5feb57e"
            try {
                assertTrue(store.setOnDeviceClassificationIfNoCloud(localId, Classification.SPAM, "test-local", modelHash, 0.8))
                val local = withContext(Dispatchers.Main) { store.provenanceFor(localId) }
                assertEquals("on_device_model_c", local?.source)
                assertEquals(modelHash, local?.modelSha256)
                store.setClassification(localId, Classification.SAFE, source = "cloud_model", score = 0.99)
                assertFalse(store.setOnDeviceClassificationIfNoCloud(localId, Classification.UNKNOWN, "late-local", modelHash, 0.91))
                assertEquals(Classification.SAFE, store.snapshotFor(localId))
                store.setClassification(localId, Classification.SCAM)
                assertFalse(store.setOnDeviceClassificationIfNoCloud(localId, Classification.SAFE, "late-local", modelHash, 0.99))
                assertEquals("A late model result must preserve a user block", Classification.SCAM, store.snapshotFor(localId))
                coroutineScope {
                    repeat(20) {
                        launch(Dispatchers.IO) {
                            store.setOnDeviceClassificationIfNoCloud(racedId, Classification.UNKNOWN, "raced-local", modelHash, 0.91)
                        }
                    }
                    launch(Dispatchers.IO) {
                        store.setClassification(racedId, Classification.SAFE, source = "cloud_model", score = 0.99)
                    }
                }
                assertEquals(Classification.SAFE, store.snapshotFor(racedId))
                val cloud = withContext(Dispatchers.Main) { store.provenanceFor(racedId) }
                assertEquals("cloud_model", cloud?.source)
                assertEquals(0.99, requireNotNull(cloud?.score), 0.000001)
            } finally {
                store.remove(listOf(localId, racedId))
            }
        }
}
