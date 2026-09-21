# CPaaS Android SMS Gateway

Turn a physical Android phone into an SMS gateway for CPaaS.

When the device is **ONLINE** (heartbeat &lt; 2 minutes), the provider router prefers **ANDROID_GATEWAY** over commercial SMS providers.

---

## Prerequisites

- Android Studio (Hedgehog / Koala or newer)
- Physical Android phone (SMS requires a real SIM — not an emulator)
- USB debugging enabled
- PC and phone on the **same Wi‑Fi**
- CPaaS API running on your PC (`http://localhost:3001/health` → ok)

---

## 1. Get a pairing code (preferred)

1. Open http://localhost:3000  
2. Login: `dev@cpaas.local` / `ChangeMeDev123!`  
3. **Gateways** → **Generate pairing code**  
4. Copy a listed API base (`http://<LAN-IP>:3001`) and the code (`ABCD-EFGH`)

You can still pair with an API key instead: **API Keys** → create a key → copy `sk_test_…`.  

---

## 2. Find your PC LAN IP (Windows)

```powershell
ipconfig
```

Look for **Wireless LAN adapter Wi-Fi** → **IPv4 Address**, e.g. `192.168.1.14`.

API base on the phone:

```text
http://192.168.1.14:3001
```

**Do not use** `localhost` or `127.0.0.1` on the phone (that points at the phone itself).  
`10.0.2.2` only works for the **emulator**.

Allow Windows Firewall for Node on private networks if registration fails.

---

## 3. Open & run the app

1. Android Studio → **Open** → `<repo>/android/gateway`  
   (open this folder only — not the monorepo root)  
2. Wait for Gradle sync (Studio may download the Gradle wrapper)  
3. Connect the phone via USB → enable file transfer / debugging  
4. Run ▶ **app** on the physical device  

---

## 4. Pair the device

In the app:

| Field | Example |
|--------|---------|
| API base URL | `http://192.168.1.14:3001` |
| Pairing code | `ABCD-EFGH` from dashboard |
| Device name | My Pixel |

1. Allow SMS / Phone / Notifications permissions  
2. Tap **Test connection** (must reach `/health`)  
3. Tap **Pair with code** (or **Register with API key**)  
4. Tap **Start gateway service**  
5. Keep a persistent notification: gateway is running  

The device stays **PENDING** until the first heartbeat, then **ONLINE**.  

---

## 5. Confirm ONLINE

- Customer dashboard → **Gateways** → device shows **ONLINE**  
- Or Admin → **Devices** at http://localhost:3002  

---

## 6. Send SMS through the phone

1. Dashboard → **Messaging**  
2. Send to a real number you control  
3. Phone should send the SMS within ~5 seconds (poll interval)  
4. Message status updates when the device reports success  

---

## API surface (device auth)

| Method | Path | Auth |
|--------|------|------|
| POST | `/v1/device/pairing-codes` | JWT / `X-Api-Key` |
| POST | `/v1/device/pair` | pairing code (public) |
| POST | `/v1/device/register` | `X-Api-Key` |
| POST | `/v1/device/heartbeat` | `X-Device-Token` |
| GET | `/v1/device/outbox` | `X-Device-Token` |
| POST | `/v1/device/send` | `X-Device-Token` (delivery report) |
| POST | `/v1/device/inbox` | `X-Device-Token` |
| GET | `/v1/device/status` | `X-Device-Token` |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Register timeout / connection refused | Wrong IP; API not running; firewall; use `http://` not `https://` for local |
| `HTTP 401` | Bad API key, pairing code, or device token |
| `HTTP 410` | Pairing code expired — generate a new one |
| Device never ONLINE | Did not tap **Start gateway**; app killed by battery optimizer |
| SMS not sending | Deny SMS permission; no SIM; dual-SIM default off |
| Falls back to Twilio/MSG91 | No ONLINE gateway — start the service |

Battery optimizers (Xiaomi/Oppo/Samsung) may kill the service — set the app to **Unrestricted**.

---

## Security notes

- Device token stored in EncryptedSharedPreferences  
- Treat `sk_test_` / `sk_live_` like passwords  
- Production: use HTTPS and disable cleartext in `network_security_config.xml`
