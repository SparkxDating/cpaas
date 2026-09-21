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
import org.json.JSONObject

class MainActivity : AppCompatActivity() {
  private val uiScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)

    val app = application as CpaasApp
    val apiBase = findViewById<EditText>(R.id.apiBase)
    val pairingCode = findViewById<EditText>(R.id.pairingCode)
    val apiKey = findViewById<EditText>(R.id.apiKey)
    val deviceName = findViewById<EditText>(R.id.deviceName)
    val status = findViewById<TextView>(R.id.status)
    val testBtn = findViewById<Button>(R.id.testBtn)
    val pairBtn = findViewById<Button>(R.id.pairBtn)
    val registerBtn = findViewById<Button>(R.id.registerBtn)
    val startBtn = findViewById<Button>(R.id.startBtn)
    val stopBtn = findViewById<Button>(R.id.stopBtn)

    apiBase.setText(app.tokenStore.apiBase)
    apiKey.setText(app.tokenStore.projectApiKey.orEmpty())
    deviceName.setText(app.tokenStore.deviceName ?: Build.MODEL)
    refreshStatus(status, app)

    requestSmsPermissions()

    if (!app.tokenStore.deviceToken.isNullOrBlank()) {
      GatewayForegroundService.start(this)
      refreshStatus(status, app, running = true)
    }

    testBtn.setOnClickListener {
      val base = normalizeBase(apiBase.text.toString()) ?: return@setOnClickListener
      testBtn.isEnabled = false
      status.text = "Checking $base/health …"
      uiScope.launch {
        try {
          val res = withContext(Dispatchers.IO) { CpaasApi(base).health() }
          val ok = res.optString("status")
          status.text = "Reachable: $base\nstatus=$ok time=${res.optString("time")}"
          Toast.makeText(this@MainActivity, "API reachable", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
          status.text = "Connection failed: ${e.message}\nUse http://<PC-LAN-IP>:3001 (not localhost)."
          Toast.makeText(this@MainActivity, e.message ?: "Unreachable", Toast.LENGTH_LONG).show()
        } finally {
          testBtn.isEnabled = true
        }
      }
    }

    pairBtn.setOnClickListener {
      val base = normalizeBase(apiBase.text.toString()) ?: return@setOnClickListener
      val code = pairingCode.text.toString().trim()
      val name = deviceName.text.toString().trim().ifBlank { Build.MODEL }
      if (code.isBlank()) {
        Toast.makeText(this, "Enter the pairing code from the dashboard", Toast.LENGTH_SHORT).show()
        return@setOnClickListener
      }
      pairBtn.isEnabled = false
      status.text = "Pairing…"
      uiScope.launch {
        try {
          val res = withContext(Dispatchers.IO) {
            CpaasApi(base).pair(code, name, Build.MODEL, Build.MANUFACTURER)
          }
          persistRegistration(app, base, name, res, apiKey = null)
          refreshStatus(status, app)
          Toast.makeText(this@MainActivity, "Paired — tap Start gateway", Toast.LENGTH_LONG).show()
        } catch (e: Exception) {
          status.text = "Pair failed: ${e.message}"
          Toast.makeText(this@MainActivity, e.message ?: "Pair failed", Toast.LENGTH_LONG).show()
        } finally {
          pairBtn.isEnabled = true
        }
      }
    }

    registerBtn.setOnClickListener {
      val base = normalizeBase(apiBase.text.toString()) ?: return@setOnClickListener
      val key = apiKey.text.toString().trim()
      val name = deviceName.text.toString().trim().ifBlank { Build.MODEL }
      if (key.isBlank()) {
        Toast.makeText(this, "API key is required for this method (or use Pair with code)", Toast.LENGTH_LONG).show()
        return@setOnClickListener
      }
      registerBtn.isEnabled = false
      status.text = "Registering…"
      uiScope.launch {
        try {
          val res = withContext(Dispatchers.IO) {
            CpaasApi(base).register(key, name, Build.MODEL, Build.MANUFACTURER)
          }
          persistRegistration(app, base, name, res, key)
          refreshStatus(status, app)
          Toast.makeText(this@MainActivity, "Registered — tap Start gateway", Toast.LENGTH_LONG).show()
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
        Toast.makeText(this, "Pair or register first", Toast.LENGTH_SHORT).show()
        return@setOnClickListener
      }
      GatewayForegroundService.start(this)
      refreshStatus(status, app, running = true)
      Toast.makeText(this, "Gateway service started", Toast.LENGTH_SHORT).show()
    }

    stopBtn.setOnClickListener {
      GatewayForegroundService.stop(this)
      refreshStatus(status, app, running = false)
      Toast.makeText(this, "Gateway service stopped", Toast.LENGTH_SHORT).show()
    }
  }

  private fun persistRegistration(
    app: CpaasApp,
    base: String,
    name: String,
    res: JSONObject,
    apiKey: String?
  ) {
    app.tokenStore.apiBase = base
    app.tokenStore.deviceName = name
    app.tokenStore.deviceToken = res.getString("deviceToken")
    app.tokenStore.deviceId = res.getString("id")
    if (apiKey != null) app.tokenStore.projectApiKey = apiKey
  }

  private fun normalizeBase(raw: String): String? {
    val base = raw.trim().trimEnd('/')
    if (base.isBlank()) {
      Toast.makeText(this, "API base is required", Toast.LENGTH_SHORT).show()
      return null
    }
    if (!base.startsWith("http://") && !base.startsWith("https://")) {
      Toast.makeText(this, "API base must start with http:// or https://", Toast.LENGTH_LONG).show()
      return null
    }
    return base
  }

  private fun refreshStatus(status: TextView, app: CpaasApp, running: Boolean? = null) {
    val id = app.tokenStore.deviceId
    status.text = if (id != null) {
      val run = when (running) {
        true -> "Gateway running. Heartbeat every 5s."
        false -> "Gateway stopped. Tap Start to go ONLINE."
        null -> "Paired. Next: Start gateway service (stays PENDING until heartbeat)."
      }
      "$run\nDevice: $id\nAPI: ${app.tokenStore.apiBase}"
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
