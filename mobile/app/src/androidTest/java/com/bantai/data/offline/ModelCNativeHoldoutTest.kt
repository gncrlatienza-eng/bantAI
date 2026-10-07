package com.bantai.data.offline

import android.net.ConnectivityManager
import android.os.Bundle
import android.os.SystemClock
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/** Explicit opt-in regression run. Private pretokenized inputs are never packaged in the app. */
@RunWith(AndroidJUnit4::class)
class ModelCNativeHoldoutTest {
    @Test
    fun nativeRuntimeMeetsReusedHoldoutRegressionGate() =
        runBlocking {
            assumeTrue(InstrumentationRegistry.getArguments().getString("evaluateModelCHoldout") == "true")
            val instrumentation = InstrumentationRegistry.getInstrumentation()
            val context = instrumentation.targetContext
            val connectivity = context.getSystemService(ConnectivityManager::class.java)
            assertNull("Native evaluation must remain offline", connectivity.activeNetwork)
            val inputs = JSONObject(File(context.getExternalFilesDir(null), "model_c_native_holdout_inputs.json").readText())
            assertEquals("31e811205619d7968ad8c02d63f3bcdce0aa0a1427ee142c5b18fe7e9003a755", inputs.getString("holdout_sha256"))
            assertEquals("85580ba9edae8ce4428ccbd09c4e80d2ba7a6aaf24c61b14c173b40ab4e8e69b", inputs.getString("checkpoint_sha256"))
            assertEquals(128, inputs.getInt("max_length"))
            val rows = inputs.getJSONArray("rows")
            assertEquals(3236, rows.length())
            val matrix = Array(3) { IntArray(3) }
            val start = SystemClock.elapsedRealtime()
            var verifiedHash = ""
            for (index in 0 until rows.length()) {
                val row = rows.getJSONObject(index)
                val tokens = row.getJSONArray("input_ids")
                val ids = LongArray(tokens.length()) { tokens.getLong(it) }
                val inspection = ModelCRuntime.inspectEncodedForEvaluation(context, ids)
                assertEquals(inputs.getString("model_sha256"), inspection.modelSha256)
                assertTrue(inspection.probabilities.all { it.isFinite() })
                assertEquals(1.0, inspection.probabilities.sum(), 0.000001)
                val predicted = inspection.probabilities.indices.maxBy { inspection.probabilities[it] }
                matrix[row.getInt("label")][predicted] += 1
                verifiedHash = inspection.modelSha256
                if ((index + 1) % 100 == 0) {
                    instrumentation.sendStatus(0, Bundle().apply { putString("stream", "Native Model C holdout ${index + 1}/${rows.length()}\n") })
                }
            }
            val f1s =
                (0..2).map { label ->
                    val tp = matrix[label][label].toDouble()
                    val fp = (0..2).sumOf { matrix[it][label] } - tp
                    val fn = matrix[label].sum() - tp
                    2.0 * tp / (2.0 * tp + fp + fn)
                }
            val macroF1 = f1s.average()
            val recall = matrix[2][2].toDouble() / matrix[2].sum()
            val result =
                JSONObject()
                    .put("model_sha256", verifiedHash)
                    .put("holdout_sha256", inputs.getString("holdout_sha256"))
                    .put("checkpoint_sha256", inputs.getString("checkpoint_sha256"))
                    .put("rows", rows.length())
                    .put("confusion_matrix", JSONArray(matrix.map { JSONArray(it.toList()) }))
                    .put("macro_f1", macroF1)
                    .put("scam_recall", recall)
                    .put("elapsed_ms", SystemClock.elapsedRealtime() - start)
            instrumentation.sendStatus(0, Bundle().apply { putString("stream", "BANTAI_NATIVE_HOLDOUT_RESULT=$result\n") })
            assertNull(connectivity.activeNetwork)
            assertTrue("Native macro-F1 regression: $macroF1", 0.9635 - macroF1 <= 0.01)
            assertTrue("Native Scam recall regression: $recall", 0.9572 - recall <= 0.01)
        }
}
