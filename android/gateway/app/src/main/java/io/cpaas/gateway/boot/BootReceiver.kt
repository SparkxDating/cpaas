package io.cpaas.gateway.boot

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import io.cpaas.gateway.CpaasApp
import io.cpaas.gateway.service.GatewayForegroundService

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return
    val app = context.applicationContext as CpaasApp
    if (app.tokenStore.deviceToken.isNullOrBlank()) return
    GatewayForegroundService.start(context)
  }
}
