package io.cpaas.gateway.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import io.cpaas.gateway.CpaasApp
import io.cpaas.gateway.api.CpaasApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

class SmsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
    val app = context.applicationContext as CpaasApp
    val token = app.tokenStore.deviceToken ?: return
    val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
    val arr = JSONArray()
    messages.forEach { sms ->
      arr.put(
        JSONObject()
          .put("fromNumber", sms.displayOriginatingAddress)
          .put("body", sms.displayMessageBody)
          .put("receivedAt", java.time.Instant.now().toString())
      )
    }
    CoroutineScope(Dispatchers.IO).launch {
      runCatching {
        CpaasApi(app.tokenStore.apiBase).inbox(token, arr)
      }
    }
  }
}
