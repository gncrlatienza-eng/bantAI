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

        // Backend base URL, read through ApiConfig. Set to the dev laptop's
        // current LAN IP so a real device on the same wifi can reach it with no
        // USB/`adb reverse` connection required. Alternatives: "http://localhost:3000/api"
        // for a USB-connected device after `adb reverse tcp:3000 tcp:3000`, or
        // "http://10.0.2.2:3000/api" for the Android Studio emulator.
        // Only localhost, 10.0.2.2, and this LAN IP are cleartext-permitted — see
        // src/debug/res/xml/network_security_config.xml. The LAN IP is
        // DHCP-assigned and can change; re-check with `ipconfig` and update both
        // this value and that file if the app stops reaching the backend.
        buildConfigField("String", "BACKEND_BASE_URL", "\"http://192.168.0.125:3000/api\"")
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
            // Deliberately not localhost: a production backend doesn't exist yet
            // (WBS 6.3.2), and defaultConfig's dev URL must never ship in a
            // release build — src/debug's network_security_config.xml already
            // makes cleartext-to-localhost debug-only, but this closes the gap
            // structurally too. Replace with the real HTTPS backend URL once
            // 6.3.2 lands.
            buildConfigField("String", "BACKEND_BASE_URL", "\"https://api.bantai.invalid/api\"")
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
    // Bridges Firebase's Task<T> callback API (FirebaseAuth.signInWithCredential,
    // FirebaseUser.getIdToken) into suspend functions via .await() -- used by
    // OnboardingViewModel's Firebase phone-auth flow.
    implementation(libs.kotlinx.coroutines.play.services)
    // Unconditional, unlike firebase-crashlytics below: OnboardingViewModel
    // unconditionally imports FirebaseAuth/PhoneAuthProvider/etc, so gating this
    // on googleServicesFile.exists() broke `compileDebugKotlin` on every CI run
    // (CI never has google-services.json -- it's gitignored). The library itself
    // compiles fine without the file; only actually initializing FirebaseApp at
    // runtime needs it, which CI never does.
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.auth)

    if (googleServicesFile.exists()) {
        implementation(libs.firebase.crashlytics)
    }
}
