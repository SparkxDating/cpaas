package io.cpaas.gateway.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import io.cpaas.gateway.CpaasApp
import io.cpaas.gateway.R
import io.cpaas.gateway.api.CpaasApi
import io.cpaas.gateway.sms.SmsSender
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

class GatewayForegroundService : Service() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private var job: Job? = null
  private val sender = SmsSender()

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startForeground(42, buildNotification(getString(R.string.notification_running)))
    if (job == null || job?.isActive != true) {
      job = scope.launch { loop() }
    }
    return START_STICKY
  }

  override fun onDestroy() {
    scope.cancel()
    super.onDestroy()
  }

  private suspend fun loop() {
    val app = application as CpaasApp
    while (scope.isActive) {
      val token = app.tokenStore.deviceToken
      val base = app.tokenStore.apiBase
      if (token.isNullOrBlank()) {
        delay(5_000)
        continue
      }
      val api = CpaasApi(base)
      runCatching {
        val bm = getSystemService(BATTERY_SERVICE) as BatteryManager
        val battery = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        val charging =
          bm.isCharging ||
            bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_STATUS) ==
            BatteryManager.BATTERY_STATUS_CHARGING
        api.heartbeat(
          deviceToken = token,
          battery = battery.coerceIn(0, 100),
          charging = charging,
          networkType = currentNetworkType(),
          signal = 0
        )

        val outbox = api.outbox(token)
        val reports = JSONArray()
        for (i in 0 until outbox.length()) {
          val item = outbox.getJSONObject(i)
          val id = item.getString("id")
          val to = item.getString("toNumber")
          val body = item.getString("body")
          var ok = false
          var err: String? = null
          try {
            sender.send(to, body)
            ok = true
          } catch (e: Exception) {
            err = e.message ?: "send_failed"
          }
          reports.put(
            JSONObject()
              .put("outboxId", id)
              .put("success", ok)
              .put("error", err)
          )
        }
        if (reports.length() > 0) {
          api.reportSend(token, reports)
        }
      }
      delay(5_000)
    }
  }

  private fun currentNetworkType(): String {
    val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    val network = cm.activeNetwork ?: return "none"
    val caps = cm.getNetworkCapabilities(network) ?: return "unknown"
    return when {
      caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
      caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "mobile"
      caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
      else -> "other"
    }
  }

  private fun buildNotification(text: String): Notification {
    val channelId = "cpaas_gateway"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val mgr = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
      mgr.createNotificationChannel(
        NotificationChannel(
          channelId,
          getString(R.string.channel_name),
          NotificationManager.IMPORTANCE_LOW
        )
      )
    }
    return NotificationCompat.Builder(this, channelId)
      .setContentTitle(getString(R.string.app_name))
      .setContentText(text)
      .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
      .setOngoing(true)
      .build()
  }

  companion object {
    fun start(context: Context) {
      val intent = Intent(context, GatewayForegroundService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }
  }
}
