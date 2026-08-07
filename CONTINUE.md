# Continue on another machine

**Paused:** Android SMS gateway pairing (API LAN health verified; app not fully paired yet).  
**Repo:** https://github.com/SparkxDating/cpaas  
**Branch:** `master`

---

## What is done

- Full CPaaS monorepo (API, worker, dashboard, admin, Prisma, Docker, SDKs)
- API binds `0.0.0.0:3001` so phones on the same Wi‑Fi can reach it
- Root `GET /` + `GET /health` for easy phone browser checks
- Android gateway app under `android/gateway` (register, heartbeat, outbox, SMS)
- Customer dashboard **Devices / Gateways** page
- Windows firewall guidance for port 3001
- Seed users + local Docker stack

## What is NOT done (resume here)

1. Open Android Studio → project folder **`android/gateway`** (not a parent folder)
2. Run app on a **physical phone** with SIM
3. Register with:
   - Base URL: `http://<PC-LAN-IP>:3001` (use `ipconfig` / `ifconfig` on the new PC)
   - API key: `sk_test_…` from dashboard (create if needed)
4. **Start gateway service** → status **ONLINE**
5. Send a test SMS from dashboard **Messaging**
6. Optional: commit any local-only tweaks after pairing works

---

## Fresh machine setup (copy-paste)

### Prerequisites

- Node.js **20+**
- Docker Desktop (running)
- Git
- Android Studio (only needed for the gateway app)
- npm 11+ recommended

### 1. Clone

```bash
git clone https://github.com/SparkxDating/cpaas.git
cd cpaas
```

### 2. Env

```bash
cp .env.example .env
```

Edit `.env` only if ports clash. Defaults match `docker-compose.yml`.

### 3. Infra + install + DB

```bash
docker compose up -d postgres redis minio minio-init mailhog
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
```

Seed prints a test API key (`sk_test_…`). Save it.

### 4. Run services

```bash
# All apps (API + worker + dashboard + admin)
npm run dev
```

Or lighter (API only — enough for phone pairing):

```bash
# terminal 1 — from repo root so .env loads
npm run dev -w @cpaas/api

# terminal 2 — optional UI
set NEXT_PUBLIC_API_URL=http://localhost:3001
npm run dev -w @cpaas/dashboard
```

### 5. Verify on PC

| Check | URL |
|--------|-----|
| Health | http://localhost:3001/health |
| Swagger | http://localhost:3001/docs |
| Dashboard | http://localhost:3000 |
| Admin | http://localhost:3002 |

### Seed logins

| Role | Email | Password |
|------|--------|----------|
| Developer | `dev@cpaas.local` | `ChangeMeDev123!` |
| Admin | `admin@cpaas.local` | `ChangeMeAdmin123!` |

### 6. Phone / LAN

```text
# Windows
ipconfig
# macOS/Linux
ifconfig   # or: ip addr
```

Phone browser (same Wi‑Fi as PC):

```text
http://<YOUR-LAN-IP>:3001/health
```

Must return `{"status":"ok",...}`.  
If it fails: start API, allow firewall port **3001**, use `http` not `https`, do not use `localhost` on the phone.

Windows firewall example:

```powershell
New-NetFirewallRule -DisplayName "CPaaS API 3001" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow -Profile Any
```

### 7. Android gateway

Full steps: [`android/gateway/README.md`](android/gateway/README.md)

```text
Android Studio → Open → <repo>/android/gateway
Run on physical device
API base URL = http://<LAN-IP>:3001
API key = sk_test_… from dashboard or seed
Register → Start gateway service → ONLINE
```

---

## Important notes

- **`.env` is not in git** (secrets). Always copy from `.env.example` on a new machine.
- **Local DB is not in git.** New machine = empty DB → run migrate + seed again. Re-create API keys if needed.
- **LAN IP changes** per network/machine. Always re-check before pairing the phone.
- API must listen on **0.0.0.0** (already set in `apps/api/src/main.ts`).
- Heavy on weak laptops: skip Android Studio until ready; run only Docker + API.

## Repo layout (quick)

```text
apps/api          NestJS :3001
apps/worker       BullMQ jobs
apps/dashboard    :3000
apps/admin        :3002
packages/database Prisma + seed
android/gateway   Kotlin SMS gateway
docker-compose.yml
CONTINUE.md       ← this file
```

## When you open a new chat

Say something like:

> Resume CPaaS from https://github.com/SparkxDating/cpaas — see CONTINUE.md. Next: Android gateway pair + test SMS.

---

*Last paused after LAN health OK on phone; gateway register/ONLINE still pending.*
