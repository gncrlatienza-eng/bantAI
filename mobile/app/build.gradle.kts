import java.net.Inet4Address
import java.net.NetworkInterface
import java.net.URI
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ktlint)
    alias(libs.plugins.detekt)
}

// Release signing. Store/key credentials live in mobile/keystore.properties
// (gitignored, never committed) rather than as literals here -- see that
// file's sibling mobile/keystore.properties.example for the expected shape.
// Absent on a fresh checkout (e.g. CI without secrets, or a teammate who
// hasn't been handed the keystore) so release signing is skipped rather than
// failing the build; only assembleRelease/bundleRelease actually need it.
val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties =
    Properties().apply {
        if (keystorePropertiesFile.exists()) {
            keystorePropertiesFile.inputStream().use { load(it) }
        }
    }

// Crash reporting (Firebase Crashlytics). Both plugins require google-services.json,
// which is per-Firebase-project config, not a secret to hardcode -- teammates get it
// from the Firebase console (see mobile/README or ask Gio) and drop it in mobile/app/.
// Gated the same way as signingConfigs above: absent on a checkout that doesn't have
// it yet, so the build stays green rather than failing with "File google-services.json
// is missing" for everyone until it's wired up.
val googleServicesFile = file("google-services.json")

val releaseBackendUrl = (project.findProperty("bantaiReleaseBackendUrl") as String?) ?: "https://api.bantai.invalid/api"

// A tester APK pointed at the placeholder, or at plain http (blocked in release),
// installs fine but can never reach the backend -- fail the build instead.
tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    doFirst {
        require(releaseBackendUrl.startsWith("https://") && !releaseBackendUrl.contains(".invalid")) {
            "Release builds need the deployed HTTPS backend: -PbantaiReleaseBackendUrl=https://<host>/api"
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
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Backend base URL, read through ApiConfig -- see debugBackendUrl above.
        // Release overrides this below with the deployed HTTPS backend.
        buildConfigField("String", "BACKEND_BASE_URL", "\"$debugBackendUrl\"")
    }

    signingConfigs {
        if (keystorePropertiesFile.exists()) {
            create("release") {
                storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            if (keystorePropertiesFile.exists()) {
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
}

androidComponents {
    onVariants(selector().withBuildType("debug")) { variant ->
        variant.sources.res?.addGeneratedSourceDirectory(
            generateDebugNetworkSecurityConfig,
            GenerateNetworkSecurityConfig::outputDir,
        )
    }
}

ktlint {
    // Android-specific import-order/idiom handling (differs from plain
    // Kotlin) -- without this ktlint flags conventional Android code style.
    android.set(true)
    version.set("1.5.0")
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
    // Spike (2026-09-16, WBS 5.3.5 follow-up): on-device latency benchmark only,
    // gated behind BuildConfig.DEBUG at runtime like the rest of DEVELOPER
    // settings — see OnnxBenchmark.kt. Not debugImplementation because a release
    // build target doesn't exist yet (WBS 6.3.2); revisit when it does so this
    // doesn't ship in a real release APK.
    implementation("com.microsoft.onnxruntime:onnxruntime-android:1.20.0")
    // Real backdrop blur for the nav bar's selection pill (2026-09-16) -- glass
    // that actually blurs the screen content behind it, not just a translucent
    // tint. dev.chrisbanes.haze, stable since 1.2.0's hazeSource/hazeEffect API.
    implementation("dev.chrisbanes.haze:haze:1.5.3")
    debugImplementation(libs.androidx.ui.tooling)
    if (googleServicesFile.exists()) {
        implementation(platform(libs.firebase.bom))
        implementation(libs.firebase.crashlytics)
    }
    // JVM unit tests (app/src/test) -- pure-Kotlin logic only (regexes, validators,
    // parsers, small pure functions), no Android framework/instrumentation needed,
    // so plain JUnit4 is enough without pulling in Robolectric.
    testImplementation(libs.junit)
}
