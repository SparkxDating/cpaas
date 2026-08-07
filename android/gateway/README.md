# CPaaS Android SMS Gateway

Kotlin Android application that turns a phone into a production SMS gateway for CPaaS.

## Features

- Login / project API key pairing
- Device registration (`POST /v1/device/register`)
- Unique device token storage (EncryptedSharedPreferences)
- Foreground service + heartbeat
- Outbox polling / WebSocket-ready REST fallback
- Send SMS + delivery callbacks
- Incoming SMS → inbox upload
- Battery, SIM, signal, network telemetry
- Offline queue + retry
- Boot receiver + auto-start
- Remote configuration from heartbeat response

## Project layout

```
android/gateway/
  app/src/main/java/io/cpaas/gateway/
    MainActivity.kt
    CpaasApp.kt
    api/CpaasApi.kt
    service/GatewayForegroundService.kt
    sms/SmsSender.kt
    sms/SmsReceiver.kt
    boot/BootReceiver.kt
    data/TokenStore.kt
  app/src/main/AndroidManifest.xml
  app/build.gradle.kts
  settings.gradle.kts
  build.gradle.kts
```

## Build

1. Open `android/gateway` in Android Studio (Hedgehog+).
2. Set `CPAAS_API_BASE` in local properties or BuildConfig.
3. Run on a physical device with SMS permission.

## Security

- Device token never logged
- TLS only in production
- Payload signatures optional via remote config `encryptPayloads`
