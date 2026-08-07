plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "io.cpaas.gateway"
  compileSdk = 35

  defaultConfig {
    applicationId = "io.cpaas.gateway"
    minSdk = 26
    targetSdk = 35
    versionCode = 1
    versionName = "1.0.0"
    buildConfigField("String", "CPAAS_API_BASE", "\"http://10.0.2.2:3001\"")
  }

  buildFeatures {
    buildConfig = true
    viewBinding = true
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  kotlinOptions { jvmTarget = "17" }
}

dependencies {
  implementation("androidx.core:core-ktx:1.15.0")
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("com.google.android.material:material:1.12.0")
  implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
  implementation("androidx.security:security-crypto:1.1.0-alpha06")
  implementation("com.squareup.okhttp3:okhttp:4.12.0")
  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
  implementation("com.squareup.moshi:moshi-kotlin:1.15.1")
}
