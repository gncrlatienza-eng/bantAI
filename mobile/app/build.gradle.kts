plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ktlint)
    alias(libs.plugins.detekt)
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

        // Backend base URL, read through ApiConfig. The default targets a
        // USB-connected device after `adb reverse tcp:3000 tcp:3000`; for the
        // Android Studio emulator override this with "http://10.0.2.2:3000/api".
        // Only localhost and 10.0.2.2 are cleartext-permitted — see
        // res/xml/network_security_config.xml before pointing at a LAN IP.
        buildConfigField("String", "BACKEND_BASE_URL", "\"http://localhost:3000/api\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
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
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    debugImplementation(libs.androidx.ui.tooling)
}
