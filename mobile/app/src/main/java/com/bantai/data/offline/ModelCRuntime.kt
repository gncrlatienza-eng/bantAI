package com.bantai.data.offline

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import ai.onnxruntime.extensions.OrtxPackage
import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import kotlin.math.exp

private const val ASSET_DIR = "model_c"
private const val MODEL_FILE = "model_int8.onnx"
private const val TOKENIZER_FILE = "tokenizer.onnx"
private const val MANIFEST_FILE = "manifest.json"
private const val MAX_LENGTH = 128
private const val BUFFER_SIZE = 1024 * 1024
private const val MODEL_C_CLASS_COUNT = 3
private const val TOKEN_BOS = 0L
private const val TOKEN_PAD = 1L
private const val TOKEN_EOS = 2L
private const val TOKEN_UNK = 3L
private const val TOKEN_MASK = 250001L

internal data class ModelCResult(
    val decision: ModelCDecision,
    val modelVersion: String,
    val modelSha256: String,
)

internal data class ModelCInspection(
    val preprocessed: String,
    val inputIds: LongArray,
    val logits: FloatArray,
    val probabilities: DoubleArray,
    val modelVersion: String,
    val modelSha256: String,
    val sessionLoadCount: Int,
)

/**
 * Process-wide Model C runtime. Sessions are loaded once and inference is
 * serialized: ORT calls are CPU-heavy and overlapping them can exhaust memory
 * on lower-end student phones. Native inference is deliberately not wrapped in
 * a coroutine timeout because cancelling a coroutine does not cancel JNI work.
 */
internal object ModelCRuntime {
    private data class Loaded(
        val environment: OrtEnvironment,
        val tokenizer: OrtSession,
        val model: OrtSession,
        val modelVersion: String,
        val modelSha256: String,
    )

    private val mutex = Mutex()

    @Volatile private var loaded: Loaded? = null

    @Volatile private var loadCount = 0

    suspend fun classify(
        context: Context,
        rawBody: String,
    ): ModelCResult =
        withContext(Dispatchers.Default) {
            mutex.withLock {
                val runtime = loaded ?: load(context.applicationContext).also { loaded = it }
                val text = ModelCPreprocessor.preprocess(rawBody)
                val ids = tokenize(runtime, text)
                val (_, probabilities) = infer(runtime, ids)
                ModelCResult(
                    decision = routeModelCProbabilities(probabilities),
                    modelVersion = runtime.modelVersion,
                    modelSha256 = runtime.modelSha256,
                )
            }
        }

    /** Test-only inspection surface: exercises the same cached sessions as production. */
    suspend fun inspectFixture(
        context: Context,
        rawBody: String,
    ): ModelCInspection =
        withContext(Dispatchers.Default) {
            mutex.withLock {
                val runtime = loaded ?: load(context.applicationContext).also { loaded = it }
                val preprocessed = ModelCPreprocessor.preprocess(rawBody)
                val ids = tokenize(runtime, preprocessed)
                val (logits, probabilities) = infer(runtime, ids)
                ModelCInspection(
                    preprocessed,
                    ids,
                    logits,
                    probabilities,
                    runtime.modelVersion,
                    runtime.modelSha256,
                    loadCount,
                )
            }
        }

    /** Encoded holdout evaluation uses the same native sessions without storing SMS in reports. */
    suspend fun inspectEncodedForEvaluation(
        context: Context,
        ids: LongArray,
    ): ModelCInspection =
        withContext(Dispatchers.Default) {
            require(ids.size in 2..MAX_LENGTH && ids.first() == TOKEN_BOS && ids.last() == TOKEN_EOS)
            mutex.withLock {
                val runtime = loaded ?: load(context.applicationContext).also { loaded = it }
                val (logits, probabilities) = infer(runtime, ids)
                ModelCInspection("", ids, logits, probabilities, runtime.modelVersion, runtime.modelSha256, loadCount)
            }
        }

    @Suppress(
        "CyclomaticComplexMethod",
        "LongMethod",
        "NestedBlockDepth",
        "TooGenericExceptionCaught",
    ) // The closeable JNI loader must clean up and rethrow every runtime failure.
    private fun load(context: Context): Loaded {
        val manifest =
            context.assets
                .open("$ASSET_DIR/$MANIFEST_FILE")
                .bufferedReader()
                .use { JSONObject(it.readText()) }
        check(manifest.optBoolean("student_test_approved")) { "Model C is not approved for student testing" }
        check(!manifest.optBoolean("production_release_approved")) { "Unexpected production approval state" }
        check(manifest.getInt("max_length") == MAX_LENGTH) { "Unexpected Model C max length" }
        check(manifest.getString("inference_contract") == "batch_1_unpadded_int64_attention_ones_v1") {
            "Unexpected Model C inference contract"
        }
        check(manifest.getString("quantization_encoding") == "exact_u8u8_offset_v1") {
            "Model C must use the verified portable CPU encoding"
        }
        check(manifest.getString("tokenizer_contract") == "model_c_sentencepiece_split_stitch_v1") {
            "Unexpected Model C tokenizer contract"
        }
        check(
            manifest.getJSONArray("labels").let {
                it.length() == MODEL_C_CLASS_COUNT &&
                    it.getString(0) == "Ham" &&
                    it.getString(1) == "Spam" &&
                    it.getString(2) == "Scam"
            },
        ) {
            "Unexpected Model C label order"
        }

        val privateDir = File(context.noBackupFilesDir, ASSET_DIR).apply { mkdirs() }
        val modelHash = manifest.getString("model_sha256")
        val tokenizerHash = manifest.getString("tokenizer_sha256")
        val modelFile = materializeVerifiedAsset(context, MODEL_FILE, modelHash, privateDir)
        val tokenizerFile = materializeVerifiedAsset(context, TOKENIZER_FILE, tokenizerHash, privateDir)
        val environment =
            OrtEnvironment.getEnvironment().also {
                // The official Android AAR enables 1DS telemetry by default.
                // Its eager initializer is removed in AndroidManifest; disable
                // runtime events too before creating either inference session.
                it.setTelemetry(false)
            }
        var tokenizer: OrtSession? = null
        try {
            tokenizer =
                sessionOptions().use { options ->
                    OrtxPackage.getPackage()
                    options.registerCustomOpLibrary(OrtxPackage.getLibraryPath())
                    environment.createSession(tokenizerFile.absolutePath, options)
                }
            val model = sessionOptions().use { options -> environment.createSession(modelFile.absolutePath, options) }
            loadCount += 1
            return Loaded(
                environment = environment,
                tokenizer = tokenizer,
                model = model,
                modelVersion = manifest.getString("model_version"),
                modelSha256 = modelHash,
            )
        } catch (error: Throwable) {
            tokenizer?.close()
            throw error
        }
    }

    private fun sessionOptions() =
        OrtSession.SessionOptions().apply {
            setIntraOpNumThreads(2)
            setInterOpNumThreads(1)
            setExecutionMode(OrtSession.SessionOptions.ExecutionMode.SEQUENTIAL)
            setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT)
        }

    @Suppress("NestedBlockDepth") // Nested streams keep verified asset materialization closeable and atomic.
    private fun materializeVerifiedAsset(
        context: Context,
        name: String,
        expectedSha256: String,
        directory: File,
    ): File {
        val destination = File(directory, name)
        if (destination.isFile && sha256(destination) == expectedSha256) return destination
        val temporary = File(directory, "$name.tmp")
        if (temporary.exists()) check(temporary.delete()) { "Could not replace stale $name temporary file" }
        val digest = MessageDigest.getInstance("SHA-256")
        context.assets.open("$ASSET_DIR/$name").buffered().use { input ->
            FileOutputStream(temporary, false).buffered().use { output ->
                val buffer = ByteArray(BUFFER_SIZE)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    digest.update(buffer, 0, count)
                    output.write(buffer, 0, count)
                }
            }
        }
        val actual = digest.digest().toHex()
        check(actual == expectedSha256) { "Bundled $name digest mismatch" }
        if (destination.exists()) check(destination.delete()) { "Could not replace invalid $name" }
        check(temporary.renameTo(destination)) { "Could not install verified $name" }
        return destination
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().buffered().use { input ->
            val buffer = ByteArray(BUFFER_SIZE)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                digest.update(buffer, 0, count)
            }
        }
        return digest.digest().toHex()
    }

    @Suppress("NestedBlockDepth") // Nested JNI result scopes must close before processing the next tokenizer segment.
    private fun tokenize(
        runtime: Loaded,
        text: String,
    ): LongArray {
        val content = mutableListOf<Long>()
        splitSpecialTokens(text).forEach { piece ->
            when (piece) {
                is TokenPiece.Special -> content += piece.id
                is TokenPiece.Ordinary -> {
                    OnnxTensor.createTensor(runtime.environment, arrayOf(piece.text)).use { input ->
                        runtime.tokenizer.run(mapOf("inputs" to input)).use { result ->
                            val wrapped = flattenLongs(result.get("tokens_cast").get().value)
                            check(wrapped.size >= 2 && wrapped.first() == TOKEN_BOS && wrapped.last() == TOKEN_EOS) {
                                "Tokenizer segment lacks the Model C BOS/EOS wrapper"
                            }
                            content += wrapped.drop(1).dropLast(1)
                        }
                    }
                }
            }
        }
        val tokenCount = minOf(content.size, MAX_LENGTH - 2)
        return LongArray(tokenCount + 2).also { ids ->
            ids[0] = TOKEN_BOS
            content.take(tokenCount).forEachIndexed { index, token -> ids[index + 1] = token }
            ids[ids.lastIndex] = TOKEN_EOS
        }
    }

    private fun infer(
        runtime: Loaded,
        ids: LongArray,
    ): Pair<FloatArray, DoubleArray> {
        OnnxTensor.createTensor(runtime.environment, arrayOf(ids)).use { inputIds ->
            OnnxTensor.createTensor(runtime.environment, arrayOf(LongArray(ids.size) { 1L })).use { attention ->
                runtime.model.run(mapOf("input_ids" to inputIds, "attention_mask" to attention)).use { result ->
                    val logits = flattenFloats(result.get("logits").get().value)
                    check(logits.size == MODEL_C_CLASS_COUNT) { "Model C returned ${logits.size} logits" }
                    val max = logits.max()
                    val exponents = logits.map { exp((it - max).toDouble()) }
                    val total = exponents.sum()
                    return logits to exponents.map { it / total }.toDoubleArray()
                }
            }
        }
    }

    private sealed interface TokenPiece {
        data class Ordinary(
            val text: String,
        ) : TokenPiece

        data class Special(
            val id: Long,
        ) : TokenPiece
    }

    private val specials =
        linkedMapOf(
            "<s>" to TOKEN_BOS,
            "<pad>" to TOKEN_PAD,
            "</s>" to TOKEN_EOS,
            "<unk>" to TOKEN_UNK,
            "<mask>" to TOKEN_MASK,
        )

    private fun splitSpecialTokens(text: String): List<TokenPiece> {
        val pieces = mutableListOf<TokenPiece>()
        var ordinaryStart = 0
        var cursor = 0
        while (cursor < text.length) {
            val match = specials.entries.firstOrNull { text.startsWith(it.key, cursor) }
            if (match == null) {
                cursor += 1
                continue
            }
            if (ordinaryStart < cursor) pieces += TokenPiece.Ordinary(text.substring(ordinaryStart, cursor))
            pieces += TokenPiece.Special(match.value)
            cursor += match.key.length
            ordinaryStart = cursor
        }
        if (ordinaryStart < text.length) pieces += TokenPiece.Ordinary(text.substring(ordinaryStart))
        return pieces
    }

    private fun flattenLongs(value: Any): LongArray =
        when (value) {
            is LongArray -> value
            is Array<*> -> value.flatMap { flattenLongs(requireNotNull(it)).asIterable() }.toLongArray()
            else -> error("Unexpected tokenizer output ${value.javaClass.name}")
        }

    private fun flattenFloats(value: Any): FloatArray =
        when (value) {
            is FloatArray -> value
            is Array<*> -> value.flatMap { flattenFloats(requireNotNull(it)).asIterable() }.toFloatArray()
            else -> error("Unexpected model output ${value.javaClass.name}")
        }

    private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }
}
