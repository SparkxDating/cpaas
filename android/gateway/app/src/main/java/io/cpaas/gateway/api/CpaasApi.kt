package io.cpaas.gateway.api

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class CpaasApi(private val baseUrl: String) {
  private val client = OkHttpClient.Builder()
    .connectTimeout(20, TimeUnit.SECONDS)
    .readTimeout(30, TimeUnit.SECONDS)
    .writeTimeout(30, TimeUnit.SECONDS)
    .build()

  private val json = "application/json; charset=utf-8".toMediaType()
  private val root = baseUrl.trimEnd('/')

  fun register(apiKey: String, name: String, model: String, manufacturer: String): JSONObject {
    val body = JSONObject()
      .put("name", name)
      .put("model", model)
      .put("manufacturer", manufacturer)
      .put("appVersion", "1.0.0")
      .put("osVersion", android.os.Build.VERSION.RELEASE)
      .toString()
      .toRequestBody(json)
    val req = Request.Builder()
      .url("$root/v1/device/register")
      .addHeader("X-Api-Key", apiKey)
      .post(body)
      .build()
    return execute(req)
  }

  fun heartbeat(
    deviceToken: String,
    battery: Int,
    charging: Boolean,
    networkType: String,
    signal: Int
  ): JSONObject {
    val body = JSONObject()
      .put("batteryPercent", battery)
      .put("isCharging", charging)
      .put("networkType", networkType)
      .put("signalStrength", signal)
      .toString()
      .toRequestBody(json)
    val req = Request.Builder()
      .url("$root/v1/device/heartbeat")
      .addHeader("X-Device-Token", deviceToken)
      .post(body)
      .build()
    return execute(req)
  }

  fun outbox(deviceToken: String): JSONArray {
    val req = Request.Builder()
      .url("$root/v1/device/outbox")
      .addHeader("X-Device-Token", deviceToken)
      .get()
      .build()
    return execute(req).optJSONArray("data") ?: JSONArray()
  }

  fun reportSend(deviceToken: String, items: JSONArray): JSONObject {
    val body = JSONObject().put("items", items).toString().toRequestBody(json)
    val req = Request.Builder()
      .url("$root/v1/device/send")
      .addHeader("X-Device-Token", deviceToken)
      .post(body)
      .build()
    return execute(req)
  }

  fun inbox(deviceToken: String, messages: JSONArray): JSONObject {
    val body = JSONObject().put("messages", messages).toString().toRequestBody(json)
    val req = Request.Builder()
      .url("$root/v1/device/inbox")
      .addHeader("X-Device-Token", deviceToken)
      .post(body)
      .build()
    return execute(req)
  }

  private fun execute(req: Request): JSONObject {
    client.newCall(req).execute().use { res ->
      val text = res.body?.string().orEmpty()
      if (!res.isSuccessful) {
        throw IllegalStateException("HTTP ${res.code}: $text")
      }
      return if (text.isBlank()) JSONObject() else JSONObject(text)
    }
  }
}
