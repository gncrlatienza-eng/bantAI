package com.bantai.util

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import java.io.File
import java.nio.LongBuffer
import kotlin.math.roundToLong

private const val SEQ_LEN = 128
private const val WARMUP_RUNS = 5
private const val TIMED_RUNS = 30

// Bare vocab-index bound, not the real XLM-RoBERTa vocab size (250,002) --
// this only needs values ONNX Runtime will accept into the embedding lookup,
// since dummy input measures the model's compute graph, not what it predicts.
private const val SAFE_TOKEN_ID_BOUND = 1000L
private const val NANOS_PER_MILLISECOND = 1_000_000.0
private const val BYTES_PER_MEGABYTE = 1024.0 * 1024.0
private const val ROUNDING_SCALE = 100.0

data class OnnxBenchmarkResult(
    val modelPath: String,
    val modelSizeMb: Double,
    val meanMs: Double,
    val minMs: Double,
    val maxMs: Double,
)

/**
 * Real-device latency check for the ONNX export from ai/scripts/export_onnx_poc.py
 * (2026-09-16, on-device feasibility spike). Deliberately NOT wired into the real
 * classification pipeline -- this only answers "how fast does the model's forward
 * pass run on this phone", separate from and not blocking on Maxene's accuracy
 * validation, which needs the real holdout set this benchmark never touches.
 *
 * Uses fixed-shape dummy token ids instead of a real tokenizer. XLM-RoBERTa's
 * SentencePiece tokenizer isn't reimplemented on-device anywhere in this app yet --
 * out of scope for a latency-only measurement, since inference time depends on the
 * compute graph and tensor shapes, not on what the token values actually mean.
 * Do not read anything about classification accuracy from this benchmark's output.
 */
object OnnxBenchmark {
    /**
     * Loads the model from [modelFileName] under the app's external files dir
     * (push it there first -- see README note this ships alongside) and runs
     * [WARMUP_RUNS] untimed + [TIMED_RUNS] timed inference passes on dummy input.
     * Returns a failure with a clear message if the file isn't there rather than
     * a raw exception, since "you forgot to adb push it" is the expected first error.
     */
    fun run(
        context: Context,
        modelFileName: String = "model_int8.onnx",
    ): Result<OnnxBenchmarkResult> {
        val modelFile = File(context.getExternalFilesDir(null), modelFileName)
        if (!modelFile.exists()) {
            return Result.failure(
                IllegalStateException(
                    "$modelFileName not found at ${modelFile.absolutePath}. " +
                        "adb push it there first: adb push <local path> ${modelFile.absolutePath}",
                ),
            )
        }

        return runCatching {
            val env = OrtEnvironment.getEnvironment()
            env.createSession(modelFile.absolutePath, OrtSession.SessionOptions()).use { session ->
                val inputIds = dummyTokenTensor(env, randomIds = true)
                val attentionMask = dummyTokenTensor(env, randomIds = false)
                val feed = mapOf("input_ids" to inputIds, "attention_mask" to attentionMask)

                repeat(WARMUP_RUNS) { session.run(feed).close() }

                val timings =
                    (1..TIMED_RUNS).map {
                        val start = System.nanoTime()
                        session.run(feed).close()
                        (System.nanoTime() - start) / NANOS_PER_MILLISECOND
                    }
                inputIds.close()
                attentionMask.close()

                OnnxBenchmarkResult(
                    modelPath = modelFile.absolutePath,
                    modelSizeMb = modelFile.length() / BYTES_PER_MEGABYTE,
                    meanMs = (timings.sum() / timings.size * ROUNDING_SCALE).roundToLong() / ROUNDING_SCALE,
                    minMs = (timings.min() * ROUNDING_SCALE).roundToLong() / ROUNDING_SCALE,
                    maxMs = (timings.max() * ROUNDING_SCALE).roundToLong() / ROUNDING_SCALE,
                )
            }
        }
    }

    // attention_mask is always all-1s (a full, unpadded sequence -- the worst
    // case for latency, since nothing is masked out of the computation);
    // input_ids only needs valid-range values, real or not.
    private fun dummyTokenTensor(
        env: OrtEnvironment,
        randomIds: Boolean,
    ): OnnxTensor {
        val values =
            LongArray(SEQ_LEN) { i ->
                if (randomIds) (i % SAFE_TOKEN_ID_BOUND) + 1 else 1L
            }
        return OnnxTensor.createTensor(env, LongBuffer.wrap(values), longArrayOf(1, SEQ_LEN.toLong()))
    }
}
