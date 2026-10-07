import java.net.Inet4Address
import java.net.NetworkInterface
import java.net.URI
import java.security.MessageDigest
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ktlint)
    alias(libs.plugins.detekt)
    alias(libs.plugins.ksp)
}

// Release signing. Store/key credentials live in mobile/keystore.properties
// (gitignored, never committed) rather than as literals here -- see that
// file's sibling mobile/keystore.properties.example for the expected shape.
// It may be absent for debug/CI work, but every release task fails closed in
// preReleaseBuild until all four values are present; an unsigned distribution
// artifact must never be produced accidentally.
val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties =
    Properties().apply {
        if (keystorePropertiesFile.exists()) {
            keystorePropertiesFile.inputStream().use { load(it) }
        }
    }

val releaseStoreFile =
    System.getenv("BANTAI_RELEASE_STORE_FILE")
        ?: keystoreProperties.getProperty("storeFile")
val releaseStorePassword =
    System.getenv("BANTAI_RELEASE_STORE_PASSWORD")
        ?: keystoreProperties.getProperty("storePassword")
val releaseKeyAlias =
    System.getenv("BANTAI_RELEASE_KEY_ALIAS")
        ?: keystoreProperties.getProperty("keyAlias")
val releaseKeyPassword =
    System.getenv("BANTAI_RELEASE_KEY_PASSWORD")
        ?: keystoreProperties.getProperty("keyPassword")
val hasReleaseSigning =
    listOf(releaseStoreFile, releaseStorePassword, releaseKeyAlias, releaseKeyPassword).all { !it.isNullOrBlank() }

// Crash reporting (Firebase Crashlytics). Both plugins require google-services.json,
// which is per-Firebase-project config, not a secret to hardcode -- teammates get it
// from the Firebase console (see mobile/README or ask Gio) and drop it in mobile/app/.
// Gated the same way as signingConfigs above: absent on a checkout that doesn't have
// it yet, so the build stays green rather than failing with "File google-services.json
// is missing" for everyone until it's wired up.
val googleServicesFile = file("google-services.json")

val releaseBackendUrl = (project.findProperty("bantaiReleaseBackendUrl") as String?) ?: "https://api.bantai.invalid/api"
val mobileModelBundleDir = providers.gradleProperty("bantaiMobileModelBundleDir")
// Resolve documented relative paths from mobile/, rather than mobile/app/.
val mobileModelBundleDirectory = mobileModelBundleDir.orNull?.let(rootProject::file)
mobileModelBundleDirectory?.let { directory ->
    require(directory.isDirectory) { "Model C bundle directory does not exist: $directory" }
    listOf("manifest.json", "model_int8.onnx", "tokenizer.onnx", "parity_fixtures.json").forEach { name ->
        require(directory.resolve(name).isFile) { "Missing Model C bundle file: ${directory.resolve(name)}" }
    }
}
val generatedMobileModelAssets = layout.buildDirectory.dir("generated/model-c-assets")

val generateMobileModelAssets =
    tasks.register<Sync>("generateMobileModelAssets") {
        into(generatedMobileModelAssets.map { it.dir("model_c") })
        mobileModelBundleDirectory?.let { from(it) }
        include("manifest.json", "model_int8.onnx", "tokenizer.onnx", "parity_fixtures.json")
    }

fun sha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().buffered().use { stream ->
        val buffer = ByteArray(1024 * 1024)
        while (true) {
            val count = stream.read(buffer)
            if (count < 0) break
            digest.update(buffer, 0, count)
        }
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
}

val verifyMobileModelBundle =
    tasks.register("verifyMobileModelBundle") {
        doLast {
            val directory =
                mobileModelBundleDirectory
                    ?: error("Release builds require -PbantaiMobileModelBundleDir=<approved Model C bundle>")
            val manifest = directory.resolve("manifest.json")
            val model = directory.resolve("model_int8.onnx")
            val tokenizer = directory.resolve("tokenizer.onnx")
            val fixtures = directory.resolve("parity_fixtures.json")
            val quality = directory.resolve("quality_evaluation.json")
            val conversion = directory.resolve("portable_conversion.json")
            listOf(manifest, model, tokenizer, fixtures).forEach { require(it.isFile) { "Missing Model C bundle file: $it" } }
            val text = manifest.readText()
            require(Regex("\"student_test_approved\"\\s*:\\s*true").containsMatchIn(text)) {
                "Model C bundle is not approved for student testing"
            }
            require(Regex("\"production_release_approved\"\\s*:\\s*false").containsMatchIn(text)) {
                "Student bundle must keep production_release_approved=false"
            }

            fun manifestHash(name: String): String =
                Regex("\"$name\"\\s*:\\s*\"([0-9a-f]{64})\"")
                    .find(text)
                    ?.groupValues
                    ?.get(1)
                    ?: error("Missing $name in Model C manifest")
            require(sha256(model) == manifestHash("model_sha256")) { "Model C model hash mismatch" }
            require(sha256(tokenizer) == manifestHash("tokenizer_sha256")) { "Model C tokenizer hash mismatch" }
            val fields = groovy.json.JsonSlurper().parse(manifest) as Map<*, *>
            require(fields["inference_contract"] == "batch_1_unpadded_int64_attention_ones_v1") {
                "Release Model C requires the exact batch-one unpadded inference contract"
            }
            require(fields["quantization_encoding"] == "exact_u8u8_offset_v1") {
                "Release Model C must use the verified portable CPU encoding"
            }
            require(quality.isFile && sha256(quality) == manifestHash("quality_report_sha256")) {
                "Missing or mismatched Model C quality evidence"
            }
            val evaluation = groovy.json.JsonSlurper().parse(quality) as Map<*, *>
            val gates = evaluation["within_gate"] as? Map<*, *>
            val results = evaluation["results"] as? Map<*, *>
            val candidate = results?.get("portable_android_unpadded") as? Map<*, *>
            require(
                evaluation["status"] == "complete" &&
                    gates?.get("portable_android_unpadded") == true &&
                    candidate?.get("sha256") == manifestHash("model_sha256") &&
                    evaluation["checkpoint_sha256"] == fields["checkpoint_sha256"],
            ) { "Model C quality gate does not match this artifact and checkpoint" }
            val reference = results?.get("fp32_reference") as? Map<*, *>

            fun metric(
                row: Map<*, *>?,
                key: String,
            ): Double =
                (row?.get(key) as? Number)?.toDouble()?.takeIf { it.isFinite() }
                    ?: error("Missing Model C metric: $key")
            require(
                (evaluation["holdout_rows"] as? Number)?.toInt() == 3236 &&
                    metric(reference, "scam_recall") - metric(candidate, "scam_recall") <= 0.01 &&
                    metric(reference, "macro_f1") - metric(candidate, "macro_f1") <= 0.01,
            ) { "Measured Model C metrics exceed release tolerances" }
            require(
                evaluation["inference_contract"] == fields["inference_contract"] &&
                    evaluation["checkpoint_sha256"] == "85580ba9edae8ce4428ccbd09c4e80d2ba7a6aaf24c61b14c173b40ab4e8e69b" &&
                    (evaluation["max_length"] as? Number)?.toInt() == 128 &&
                    evaluation["holdout_reused"] == true &&
                    evaluation["independent_final_evaluation"] == false &&
                    evaluation["holdout_sha256"] == "31e811205619d7968ad8c02d63f3bcdce0aa0a1427ee142c5b18fe7e9003a755" &&
                    reference?.get("sha256") == "b402b28c8c9aa384e50068d25db86ae40287437e64942323829880901dd13253",
            ) { "Model C quality evidence must use the canonical reference and input contract" }
            require(conversion.isFile && sha256(conversion) == manifestHash("conversion_report_sha256")) {
                "Missing or mismatched portable conversion evidence"
            }
            val derivation = groovy.json.JsonSlurper().parse(conversion) as Map<*, *>
            require(
                derivation["portable_model_sha256"] == fields["model_sha256"] &&
                    derivation["source_model_sha256"] == "2478923ccdb9fc9db9de0644f3eb3eb8cc7e4f6421a1b222dbae84b3b5feb57e" &&
                    (derivation["converted_initializers"] as? List<*>)?.size == 148,
            ) { "Portable conversion identity does not match this Model C artifact" }
        }
    }

val verifyNativeModelQuality =
    tasks.register("verifyNativeModelQuality") {
        dependsOn(verifyMobileModelBundle)
        doLast {
            val directory = requireNotNull(mobileModelBundleDirectory)
            val manifest = groovy.json.JsonSlurper().parse(directory.resolve("manifest.json")) as Map<*, *>
            val report = directory.resolve("native_quality_evaluation.json")
            require(report.isFile && sha256(report) == manifest["native_quality_report_sha256"]) {
                "Release Model C requires hash-bound Android native quality evidence"
            }
            val native = groovy.json.JsonSlurper().parse(report) as Map<*, *>
            val reference = native["reference"] as? Map<*, *>
            require(
                native["status"] == "complete" &&
                    native["within_gate"] == true &&
                    native["model_sha256"] == manifest["model_sha256"] &&
                    native["checkpoint_sha256"] == manifest["checkpoint_sha256"] &&
                    native["holdout_sha256"] == "31e811205619d7968ad8c02d63f3bcdce0aa0a1427ee142c5b18fe7e9003a755" &&
                    native["inference_contract"] == manifest["inference_contract"] &&
                    native["native_runtime"] == "Android ONNX Runtime 1.30.0" &&
                    native["model_version"] == manifest["model_version"] &&
                    reference?.get("sha256") == "b402b28c8c9aa384e50068d25db86ae40287437e64942323829880901dd13253" &&
                    (reference?.get("macro_f1") as? Number)?.toDouble() == 0.9635 &&
                    (reference?.get("scam_recall") as? Number)?.toDouble() == 0.9572 &&
                    (native["max_length"] as? Number)?.toInt() == 128 &&
                    (native["rows"] as? Number)?.toInt() == 3236 &&
                    native["holdout_reused"] == true &&
                    native["independent_final_evaluation"] == false &&
                    native["physical_device_validated"] == false,
            ) { "Native Model C quality evidence does not match this student artifact" }
            val matrix =
                (native["confusion_matrix"] as List<*>).map { row ->
                    (row as List<*>)
                        .map {
                            val number = (it as Number).toDouble()
                            require(number.isFinite() && number == number.toInt().toDouble())
                            number.toInt()
                        }.also { values ->
                            require(values.size == 3 && values.all { it >= 0 })
                        }
                }
            require(matrix.size == 3 && matrix.map { it.sum() } == listOf(1787, 958, 491))
            val f1 =
                (0..2)
                    .map { label ->
                        val tp = matrix[label][label].toDouble()
                        val fp = matrix.sumOf { it[label] } - tp
                        val fn = matrix[label].sum() - tp
                        2.0 * tp / (2.0 * tp + fp + fn)
                    }.average()
            val recall = matrix[2][2].toDouble() / matrix[2].sum()
            require(0.9635 - f1 <= 0.01 && 0.9572 - recall <= 0.01) {
                "Actual Android native Model C quality exceeds the regression tolerance"
            }
        }
    }

// A tester APK pointed at the placeholder, or at plain http (blocked in release),
// installs fine but can never reach the backend -- fail the build instead.
tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    dependsOn(verifyMobileModelBundle)
    dependsOn(verifyNativeModelQuality)
    doFirst {
        require(releaseBackendUrl.startsWith("https://") && !releaseBackendUrl.contains(".invalid")) {
            "Release builds need the deployed HTTPS backend: -PbantaiReleaseBackendUrl=https://<host>/api"
        }
        require(hasReleaseSigning) {
            "Release builds require the team signing identity through BANTAI_RELEASE_* environment variables or mobile/keystore.properties"
        }
    }
}

// Debug backend URL. A real phone on the same wifi reaches the backend at the dev
// laptop's LAN IP -- no USB/`adb reverse` needed -- but that IP is DHCP-assigned
// and changes with the network (a hard-coded 192.168.0.125 went stale this way),
// so it's detected from this machine's interfaces on every build instead.
// Virtual adapters (WSL/Hyper-V, VirtualBox, VMware, Docker, Tailscale) are
// skipped since a phone can't reach them; Wi-Fi is preferred over Ethernet.
// Override per build, e.g. USB: -PbantaiBackendUrl=http://localhost:3000/api,
// emulator: -PbantaiBackendUrl=http://10.0.2.2:3000/api
fun detectLanIp(): String? {
    val virtualAdapter = Regex("vEthernet|Hyper-V|VirtualBox|vboxnet|VMware|docker|WSL|Tailscale", RegexOption.IGNORE_CASE)
    val wifiAdapter = Regex("wi-?fi|wlan|wireless", RegexOption.IGNORE_CASE)
    return NetworkInterface
        .getNetworkInterfaces()
        .toList()
        .filter { it.isUp && !it.isLoopback && !it.isVirtual && !virtualAdapter.containsMatchIn("${it.name} ${it.displayName}") }
        .sortedByDescending { wifiAdapter.containsMatchIn("${it.name} ${it.displayName}") }
        .flatMap { it.inetAddresses.toList() }
        .filterIsInstance<Inet4Address>()
        .firstOrNull { it.isSiteLocalAddress }
        ?.hostAddress
}

val debugBackendUrl =
    (project.findProperty("bantaiBackendUrl") as String?)
        ?: detectLanIp()?.let { "http://$it:3000/api" }
        ?: "http://10.0.2.2:3000/api"
val debugBackendHost: String = URI(debugBackendUrl).host
logger.lifecycle("bantAI debug backend URL: $debugBackendUrl")

// The debug cleartext allowlist has to name the same host as the URL above, so
// it's generated from src/debug/network_security_config.template.xml rather
// than kept as a static res file that silently drifts from the detected IP.
abstract class GenerateNetworkSecurityConfig : DefaultTask() {
    @get:Input
    abstract val backendHost: Property<String>

    @get:InputFile
    @get:PathSensitive(PathSensitivity.NONE)
    abstract val template: RegularFileProperty

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @TaskAction
    fun generate() {
        val host = backendHost.get()
        // localhost/10.0.2.2 are already in the template; a duplicate <domain> is rejected at runtime.
        val entry = if (host in setOf("localhost", "10.0.2.2")) "" else "<domain includeSubdomains=\"false\">$host</domain>"
        val xml = template.get().asFile.readText()
        val xmlDir = outputDir.dir("xml").get().asFile
        xmlDir.mkdirs()
        File(xmlDir, "network_security_config.xml").writeText(xml.replace("<!-- @BACKEND_HOST_ENTRY@ -->", entry))
    }
}

val generateDebugNetworkSecurityConfig =
    tasks.register<GenerateNetworkSecurityConfig>("generateDebugNetworkSecurityConfig") {
        backendHost.set(debugBackendHost)
        template.set(layout.projectDirectory.file("src/debug/network_security_config.template.xml"))
    }

if (googleServicesFile.exists()) {
    apply(plugin = "com.google.gms.google-services")
    apply(plugin = "com.google.firebase.crashlytics")
}

android {
    namespace = "com.bantai"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.bantai"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "1.1"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Backend base URL, read through ApiConfig -- see debugBackendUrl above.
        // Release overrides this below with the deployed HTTPS backend.
        buildConfigField("String", "BACKEND_BASE_URL", "\"$debugBackendUrl\"")
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = rootProject.file(requireNotNull(releaseStoreFile))
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            // Never defaultConfig's dev URL: src/main's network_security_config.xml
            // blocks all cleartext in release, so the deployed backend must be
            // HTTPS. Supplied per build (the tester APK), e.g.
            // ./gradlew assembleRelease -PbantaiReleaseBackendUrl=https://api.example.com/api
            // The placeholder only keeps non-release tasks configurable; the
            // check below refuses to package a release APK with it.
            buildConfigField("String", "BACKEND_BASE_URL", "\"$releaseBackendUrl\"")
        }
        // Release's R8-optimized, non-debuggable code against the dev backend,
        // signed with the debug key: for judging smoothness on a phone (debug
        // builds of Compose run several times slower than what testers get)
        // and for in-person UAT on the dev laptop's backend.
        //   ./gradlew installUat -PbantaiBackendUrl=http://localhost:3000/api
        create("uat") {
            initWith(getByName("release"))
            signingConfig = signingConfigs.getByName("debug")
            buildConfigField("String", "BACKEND_BASE_URL", "\"$debugBackendUrl\"")
            matchingFallbacks += listOf("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = "11"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    androidResources {
        noCompress += "onnx"
    }

    sourceSets.getByName("main").assets.srcDir(generatedMobileModelAssets)
}

tasks.named("preBuild").configure { dependsOn(generateMobileModelAssets) }

androidComponents {
    // uat talks to the same dev backend over plain http, so it needs the same allowlist.
    onVariants(selector().withBuildType("debug")) { variant ->
        variant.sources.res?.addGeneratedSourceDirectory(
            generateDebugNetworkSecurityConfig,
            GenerateNetworkSecurityConfig::outputDir,
        )
    }
    onVariants(selector().withBuildType("uat")) { variant ->
        variant.sources.res?.addGeneratedSourceDirectory(
            generateDebugNetworkSecurityConfig,
            GenerateNetworkSecurityConfig::outputDir,
        )
    }
}

ksp {
    // Checked-in schema history, so later Room migrations can be tested against it.
    arg("room.schemaLocation", "$projectDir/schemas")
}

ktlint {
    // Android-specific import-order/idiom handling (differs from plain
    // Kotlin) -- without this ktlint flags conventional Android code style.
    android.set(true)
    version.set("1.5.0")
    // Vendored AOSP MMS code (see mms/pdu/README.md) keeps upstream's style.
    filter {
        exclude {
            it.file.path
                .replace('\\', '/')
                .contains("/com/bantai/mms/pdu/")
        }
    }
}

detekt {
    buildUponDefaultConfig = true
    config.setFrom(files("$projectDir/detekt.yml"))
    // Baseline the first pass rather than fixing 80+ pre-existing files blind:
    // everything already in the codebase is grandfathered in here, so only
    // *new* issues in future PRs actually fail the build. Same "start
    // lenient, tighten later" approach used for ai/, backend/, and web/.
    baseline = file("$projectDir/detekt-baseline.xml")
}

// Same vendored AOSP MMS package as the ktlint filter above.
tasks.withType<io.gitlab.arturbosch.detekt.Detekt>().configureEach {
    exclude("**/com/bantai/mms/pdu/**")
}
tasks.withType<io.gitlab.arturbosch.detekt.DetektCreateBaselineTask>().configureEach {
    exclude("**/com/bantai/mms/pdu/**")
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.accompanist.permissions)
    implementation("androidx.datastore:datastore-preferences:1.1.1")
    // 1.0.0 is the last stable release — the 1.1.0-alpha* line has never
    // graduated past alpha, and SecureTokenStore's whole job is protecting the
    // one credential this app has, which shouldn't rest on a pre-release build.
    implementation("androidx.security:security-crypto:1.0.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-process:2.8.7")
    // Release inference uses ONNX Runtime and the SentencePiece tokenizer custom op.
    implementation("com.microsoft.onnxruntime:onnxruntime-android:1.30.0")
    implementation("com.microsoft.onnxruntime:onnxruntime-extensions-android:0.13.0")
    // Real backdrop blur for the nav bar's selection pill (2026-09-16) -- glass
    // that actually blurs the screen content behind it, not just a translucent
    // tint. dev.chrisbanes.haze, stable since 1.2.0's hazeSource/hazeEffect API.
    implementation("dev.chrisbanes.haze:haze:1.5.3")
    // Local message/classification storage (replaced JSON-file and single-key
    // DataStore blobs that were rewritten whole on every change).
    // Background check for newly published safety tips (TipCheckWorker).
    implementation(libs.androidx.work.runtime.ktx)
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)
    debugImplementation(libs.androidx.ui.tooling)
    if (googleServicesFile.exists()) {
        implementation(platform(libs.firebase.bom))
        implementation(libs.firebase.crashlytics)
    }
    // JVM unit tests (app/src/test) -- pure-Kotlin logic only (regexes, validators,
    // parsers, small pure functions), no Android framework/instrumentation needed,
    // so plain JUnit4 is enough without pulling in Robolectric.
    testImplementation(libs.junit)
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
}
