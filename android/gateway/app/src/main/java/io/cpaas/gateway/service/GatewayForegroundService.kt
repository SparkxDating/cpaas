package io.cpaas.gateway.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import io.cpaas.gateway.CpaasApp
import io.cpaas.gateway.api.CpaasApi
import io.cpaas.gateway.sms.SmsSender
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

class GatewayForegroundService : Service() {
  private val scope = CoroutineScope(Dispatchers.IO)
  private var job: Job? = null
  private val sender = SmsSender()

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startForeground(42, buildNotification("CPaaS gateway running"))
    if (job == null) {
      job = scope.launch { loop() }
    }
    return START_STICKY
  }

  private suspend fun loop() {
    val app = application as CpaasApp
    val api = CpaasApi(app.tokenStore.apiBase)
    while (scope.isActive) {
      val token = app.tokenStore.deviceToken
      if (token.isNullOrBlank()) {
        delay(5_000)
        continue
      }
      runCatching {
        val bm = getSystemService(BATTERY_SERVICE) as BatteryManager
        val battery = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        api.heartbeat(token, battery, false, "mobile", 0)

        val outbox = api.outbox(token)
        val reports = JSONArray()
        for (i in 0 until outbox.length()) {
          val item = outbox.getJSONObject(i)
          val id = item.getString("id")
          val to = item.getString("toNumber")
          val body = item.getString("body")
          val ok = runCatching { sender.send(to, body); true }.getOrDefault(false)
          reports.put(
            JSONObject()
              .put("outboxId", id)
              .put("success", ok)
              .put("error", if (ok) null else "send_failed")
          )
        }
        if (reports.length() > 0) {
          api.reportSend(token, reports)
        }
      }
      delay(5_000)
    }
  }

  private fun buildNotification(text: String): Notification {
    val channelId = "cpaas_gateway"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val mgr = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
      mgr.createNotificationChannel(
        NotificationChannel(channelId, "CPaaS Gateway", NotificationManager.IMPORTANCE_LOW)
      )
    }
    return NotificationCompat.Builder(this, channelId)
      .setContentTitle("CPaaS SMS Gateway")
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
