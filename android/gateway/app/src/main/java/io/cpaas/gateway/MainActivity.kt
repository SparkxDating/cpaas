package io.cpaas.gateway

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import io.cpaas.gateway.api.CpaasApi
import io.cpaas.gateway.service.GatewayForegroundService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : AppCompatActivity() {
  private val uiScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)

    val app = application as CpaasApp
    val apiBase = findViewById<EditText>(R.id.apiBase)
    val apiKey = findViewById<EditText>(R.id.apiKey)
    val deviceName = findViewById<EditText>(R.id.deviceName)
    val status = findViewById<TextView>(R.id.status)
    val registerBtn = findViewById<Button>(R.id.registerBtn)
    val startBtn = findViewById<Button>(R.id.startBtn)

    apiBase.setText(app.tokenStore.apiBase)
    apiKey.setText(app.tokenStore.projectApiKey.orEmpty())
    deviceName.setText(app.tokenStore.deviceName ?: Build.MODEL)
    refreshStatus(status, app)

    requestSmsPermissions()

    registerBtn.setOnClickListener {
      val base = apiBase.text.toString().trim().trimEnd('/')
      val key = apiKey.text.toString().trim()
      val name = deviceName.text.toString().trim().ifBlank { Build.MODEL }

      if (base.isBlank() || key.isBlank()) {
        Toast.makeText(this, "API base and API key are required", Toast.LENGTH_SHORT).show()
        return@setOnClickListener
      }
      if (!base.startsWith("http://") && !base.startsWith("https://")) {
        Toast.makeText(this, "API base must start with http:// or https://", Toast.LENGTH_LONG).show()
        return@setOnClickListener
      }

      registerBtn.isEnabled = false
      status.text = "Registering…"

      uiScope.launch {
        try {
          val res = withContext(Dispatchers.IO) {
            CpaasApi(base).register(key, name, Build.MODEL, Build.MANUFACTURER)
          }
          app.tokenStore.apiBase = base
          app.tokenStore.projectApiKey = key
          app.tokenStore.deviceName = name
          app.tokenStore.deviceToken = res.getString("deviceToken")
          app.tokenStore.deviceId = res.getString("id")
          refreshStatus(status, app)
          Toast.makeText(this@MainActivity, "Device registered — tap Start gateway", Toast.LENGTH_LONG).show()
        } catch (e: Exception) {
          status.text = "Register failed: ${e.message}"
          Toast.makeText(this@MainActivity, e.message ?: "Register failed", Toast.LENGTH_LONG).show()
        } finally {
          registerBtn.isEnabled = true
        }
      }
    }

    startBtn.setOnClickListener {
      if (app.tokenStore.deviceToken.isNullOrBlank()) {
        Toast.makeText(this, "Register device first", Toast.LENGTH_SHORT).show()
        return@setOnClickListener
      }
      GatewayForegroundService.start(this)
      status.text = "Gateway running. Heartbeat every 5s.\nDevice: ${app.tokenStore.deviceId}"
      Toast.makeText(this, "Gateway service started", Toast.LENGTH_SHORT).show()
    }
  }

  private fun refreshStatus(status: TextView, app: CpaasApp) {
    val id = app.tokenStore.deviceId
    status.text = if (id != null) {
      "Registered: $id\nAPI: ${app.tokenStore.apiBase}\nNext: Start gateway service"
    } else {
      getString(R.string.status_not_registered)
    }
  }

  private fun requestSmsPermissions() {
    val needed = mutableListOf(
      Manifest.permission.SEND_SMS,
      Manifest.permission.RECEIVE_SMS,
      Manifest.permission.READ_SMS,
      Manifest.permission.READ_PHONE_STATE
    )
    if (Build.VERSION.SDK_INT >= 33) {
      needed.add(Manifest.permission.POST_NOTIFICATIONS)
    }
    val missing = needed.filter {
      ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
    }
    if (missing.isNotEmpty()) {
      ActivityCompat.requestPermissions(this, missing.toTypedArray(), 1001)
    }
  }

  override fun onDestroy() {
    uiScope.cancel()
    super.onDestroy()
  }
}
