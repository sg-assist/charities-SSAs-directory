plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
}

android {
    namespace = "org.unfpa.otg"
    compileSdk = 35

    defaultConfig {
        applicationId = "org.unfpa.otg"
        minSdk = 24          // Android 7.0 — LiteRT-LM minimum
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            // Signing config references keystore in encrypted CI secret — see README
        }
        debug {
            isDebuggable = true
            applicationIdSuffix = ".debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }

    // RTL support (required for Urdu, Dari, Pashto)
    defaultConfig {
        vectorDrawables.useSupportLibrary = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }

    // Large model file — exclude from compression so DownloadManager can resume
    aaptOptions {
        noCompress += listOf("litertlm", "onnx")
    }
}

dependencies {
    // ── Compose UI ────────────────────────────────────────────────────────────
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)

    // ── Markdown rendering ────────────────────────────────────────────────────
    implementation(libs.markwon.core)
    implementation(libs.markwon.tables)
    implementation(libs.markwon.strikethrough)

    // ── Local LLM — Gemma 4 via LiteRT-LM ────────────────────────────────────
    implementation(libs.mediapipe.tasks.genai)

    // ── On-device embeddings — multilingual MiniLM via ONNX Runtime ──────────
    implementation(libs.onnxruntime.android)

    // ── Database — Room SQLite ────────────────────────────────────────────────
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)

    // ── OTA sync + networking ─────────────────────────────────────────────────
    implementation(libs.work.runtime.ktx)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)

    // ── Persistence ───────────────────────────────────────────────────────────
    implementation(libs.datastore.preferences)

    // ── Export — DOCX + PDF ───────────────────────────────────────────────────
    implementation(libs.apache.poi.ooxml)
    implementation(libs.itext7.core)

    // ── Supabase client ───────────────────────────────────────────────────────
    implementation(platform(libs.supabase.bom))
    implementation(libs.supabase.postgrest)
    implementation(libs.supabase.storage)
    implementation(libs.ktor.client.android)

    // ── Coroutines ────────────────────────────────────────────────────────────
    implementation(libs.kotlinx.coroutines.android)

    // ── JSON ─────────────────────────────────────────────────────────────────
    implementation(libs.kotlinx.serialization.json)

    // ── Testing ───────────────────────────────────────────────────────────────
    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.ui.test.junit4)
    debugImplementation(libs.androidx.ui.tooling)
    debugImplementation(libs.androidx.ui.test.manifest)
}
