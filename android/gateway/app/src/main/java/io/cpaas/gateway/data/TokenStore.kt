package io.cpaas.gateway.data

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class TokenStore(context: Context) {
  private val masterKey = MasterKey.Builder(context)
    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
    .build()

  private val prefs = EncryptedSharedPreferences.create(
    context,
    "cpaas_gateway",
    masterKey,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
  )

  var apiBase: String
    get() = prefs.getString("api_base", null) ?: io.cpaas.gateway.BuildConfig.CPAAS_API_BASE
    set(value) = prefs.edit().putString("api_base", value).apply()

  var projectApiKey: String?
    get() = prefs.getString("project_api_key", null)
    set(value) = prefs.edit().putString("project_api_key", value).apply()

  var deviceToken: String?
    get() = prefs.getString("device_token", null)
    set(value) = prefs.edit().putString("device_token", value).apply()

  var deviceId: String?
    get() = prefs.getString("device_id", null)
    set(value) = prefs.edit().putString("device_id", value).apply()

  var deviceName: String?
    get() = prefs.getString("device_name", null)
    set(value) = prefs.edit().putString("device_name", value).apply()
}
