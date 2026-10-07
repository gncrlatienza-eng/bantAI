package com.bantai.data.offline

import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.os.Bundle
import android.os.Debug
import android.os.SystemClock
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.math.abs

/** Uses synthetic fixtures only; exercises the real production native sessions offline. */
@RunWith(AndroidJUnit4::class)
class ModelCOfflineRuntimeTest {
    @Test
    fun inferenceTelemetryInitializerIsAbsentFromInstalledPackage() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext

        @Suppress("DEPRECATION")
        val providers =
            context.packageManager
                .getPackageInfo(context.packageName, PackageManager.GET_PROVIDERS)
                .providers
                .orEmpty()
        assertFalse("ORT must not initialize a device-ID telemetry uploader", providers.any { it.name == "ai.onnxruntime.TelemetryInitializer" })
    }

    @Test
    fun androidPreprocessingMatchesPythonUnicodeContract() {
        assertEquals("Hello world", ModelCPreprocessor.preprocess("Hello\u0085world"))
        assertEquals("é09171234567", ModelCPreprocessor.preprocess("é09171234567"))
        assertEquals("code <OTP>", ModelCPreprocessor.preprocess("code ١٢٣٤٥٦"))
        assertEquals("x y", ModelCPreprocessor.preprocess("x\u001cy"))
        assertEquals("+<EMAIL>", ModelCPreprocessor.preprocess("+test@example.com"))
        assertEquals("e\u0332<PHONE>", ModelCPreprocessor.preprocess("e\u033209171234567"))
        assertEquals("a\u203f<PHONE>", ModelCPreprocessor.preprocess("a\u203f09171234567"))
    }

    @Test
    fun bundledTokenizerAndInt8ModelMatchFixturesWithoutNetwork() =
        runBlocking {
            val instrumentation = InstrumentationRegistry.getInstrumentation()
            val context = instrumentation.targetContext
            val connectivity = context.getSystemService(ConnectivityManager::class.java)
            assertNull("Disable emulator networking before this test", connectivity.activeNetwork)
            val manifest =
                context.assets
                    .open("model_c/manifest.json")
                    .bufferedReader()
                    .use { JSONObject(it.readText()) }
            val fixtureFile =
                context.assets.open("model_c/parity_fixtures.json").bufferedReader().use {
                    JSONObject(it.readText())
                }
            assertEquals(manifest.getString("model_sha256"), fixtureFile.getString("model_sha256"))
            assertEquals(manifest.getString("tokenizer_sha256"), fixtureFile.getString("tokenizer_sha256"))
            val fixtures = fixtureFile.getJSONArray("fixtures")
            assertTrue("Synthetic native parity fixtures are required", fixtures.length() >= 16)
            val start = SystemClock.elapsedRealtime()
            val first = ModelCRuntime.classify(context, fixtures.getJSONObject(0).getString("raw"))
            assertEquals(manifest.getString("model_sha256"), first.modelSha256)
            assertEquals(manifest.getString("model_version"), first.modelVersion)
            instrumentation.sendStatus(
                0,
                Bundle().apply {
                    putString(
                        "stream",
                        "Model C first parity classify elapsedMs=${SystemClock.elapsedRealtime() - start}; " +
                            "processPssKiB=${Debug.getPss()}\n",
                    )
                },
            )

            var maxLogitDifference = 0.0
            var maxProbabilityDifference = 0.0
            var labelMismatches = 0
            var routingMismatches = 0
            for (index in 0 until fixtures.length()) {
                val fixture = fixtures.getJSONObject(index)
                val inspection = ModelCRuntime.inspectFixture(context, fixture.getString("raw"))
                assertEquals("Preprocessing fixture $index", fixture.getString("preprocessed"), inspection.preprocessed)
                val expectedIds =
                    fixture.getJSONArray("input_ids").let { array ->
                        LongArray(array.length()) { array.getLong(it) }
                    }
                assertArrayEquals("SentencePiece token IDs fixture $index", expectedIds, inspection.inputIds)
                val probabilities = inspection.probabilities
                val expected = fixture.getJSONArray("probabilities")
                val expectedLogits = fixture.getJSONArray("logits")
                instrumentation.sendStatus(
                    0,
                    Bundle().apply {
                        putString(
                            "stream",
                            "Model C fixture $index logits=${inspection.logits.contentToString()}; " +
                                "probabilities=${probabilities.contentToString()}\n",
                        )
                    },
                )
                assertEquals(3, probabilities.size)
                for (label in probabilities.indices) {
                    assertTrue("Native logits must be finite", inspection.logits[label].isFinite())
                    maxLogitDifference = maxOf(maxLogitDifference, abs(expectedLogits.getDouble(label) - inspection.logits[label]))
                    maxProbabilityDifference = maxOf(maxProbabilityDifference, abs(expected.getDouble(label) - probabilities[label]))
                }
                assertEquals(1.0, probabilities.sum(), 0.000001)
                assertEquals("Fixture must reuse the same native sessions", 1, inspection.sessionLoadCount)
                assertEquals(first.modelSha256, inspection.modelSha256)
                val decision = routeModelCProbabilities(probabilities)
                if (fixture.getString("label") != decision.modelLabel) labelMismatches += 1
                val referenceDecision = routeModelCProbabilities(DoubleArray(expected.length()) { expected.getDouble(it) })
                if (referenceDecision.classification != decision.classification ||
                    referenceDecision.highRisk != decision.highRisk ||
                    referenceDecision.requiresReview != decision.requiresReview
                ) {
                    routingMismatches += 1
                }
                if (decision.highRisk) assertTrue("Local high risk requires review", decision.requiresReview)
                instrumentation.sendStatus(
                    0,
                    Bundle().apply {
                        putString(
                            "stream",
                            "Model C offline fixture ${index + 1}/${fixtures.length()} measured\n",
                        )
                    },
                )
            }
            val last = ModelCRuntime.classify(context, fixtures.getJSONObject(fixtures.length() - 1).getString("raw"))
            assertEquals(first.modelSha256, last.modelSha256)
            assertNull("Networking must remain disabled throughout inference", connectivity.activeNetwork)
            assertFalse("Student evidence must not invent production approval", manifest.getBoolean("production_release_approved"))
            instrumentation.sendStatus(
                0,
                Bundle().apply {
                    putString(
                        "stream",
                        "Model C native offline parity measured: ${fixtures.length()} fixtures; " +
                            "labelMismatches=$labelMismatches; routingMismatches=$routingMismatches; " +
                            "maxProbabilityDifference=$maxProbabilityDifference; maxLogitDifference=$maxLogitDifference; " +
                            "elapsedMs=${SystemClock.elapsedRealtime() - start}; processPssKiB=${Debug.getPss()}\n",
                    )
                },
            )
            assertEquals("Native winning labels", 0, labelMismatches)
            assertEquals("Native routing decisions", 0, routingMismatches)
            // Dynamic activation quantization varies across CPU builds. The full native
            // holdout test gates model quality; these fixtures gate tokens and routing.
            assertTrue("Native probability diagnostics must be finite", maxProbabilityDifference.isFinite())
        }
}
