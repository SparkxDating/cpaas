package io.cpaas.gateway.sms

import android.telephony.SmsManager

class SmsSender {
  fun send(to: String, body: String) {
    val manager = SmsManager.getDefault()
    val parts = manager.divideMessage(body)
    if (parts.size == 1) {
      manager.sendTextMessage(to, null, body, null, null)
    } else {
      manager.sendMultipartTextMessage(to, null, parts, null, null)
    }
  }
}
