# Continue on another machine

**Updated:** 2026-09-21 — pairing code is on `master`. Live SMS from the Samsung gateway was delivered and marked SENT.  
**Current phase:** Push this commit if it should be on GitHub.  
**Repo:** https://github.com/SparkxDating/cpaas  
**Branch:** `master` (pairing changes committed locally; not pushed unless you ask)  
**Local clone:** `C:\Users\manoj\cpaas`

---

## What is done

- Full CPaaS monorepo (API, worker, dashboard, Prisma, Docker, SDKs)
- API binds `0.0.0.0:3001` so phones on the same Wi‑Fi can reach it
- Root `GET /` + `GET /health` for phone browser checks
- Android gateway app under `android/gateway`
- Customer dashboard **Android gateways** page
- Seed users + local Docker stack

### Pairing phase (this session)

- Dashboard **pairing codes** (8-char, 10 min) + detected LAN API URLs
- Phone can **Test connection**, **Pair with code**, or still register with `sk_test_…`
- Devices stay **PENDING** until the first heartbeat, then **ONLINE**
- Stale gateways (no heartbeat for 2 min) become **OFFLINE**
- Outbox rows are claimed (`QUEUED` → `SENDING`) to avoid double-send
- Inbound SMS from the phone is stored as an INBOUND message
- Gateway queued SMS stay `SENDING` until the device reports success (not marked sent early)
- Disable / enable a device from the dashboard
- Start / stop gateway service in the Android app

---

## This PC as of 2026-09-21 evening

| Item | Status |
|------|--------|
| Clone | `C:\Users\manoj\cpaas` |
| `.env` | Present (`127.0.0.1` for Postgres/Redis) |
| Postgres | Windows PostgreSQL 16 service `postgresql-x64-16` on `127.0.0.1:5432` (user `cpaas` / `cpaas_secret`) |
| Redis | Windows Redis 8.10.1 on `127.0.0.1:6379` |
| DB migrate + seed | Done |
| `npm run dev` | Running — health http://localhost:3001/health |
| Dashboard | http://localhost:3000 — `dev@cpaas.local` / `ChangeMeDev123!` |
| Firewall TCP 3001 | Allow rule `CPaaS API 3001` |
| Android Studio | Installed at `C:\Program Files\Android\Android Studio\bin\studio64.exe` |
| Docker Desktop | Installed, but the engine GUI does not stay up on this PC. Do not depend on `docker compose` here. |
| Pairing code changes | Committed on local `master`. Do not `git checkout` / reset unrelated local edits. |
| Wi‑Fi IPv4 | `192.168.1.6` (re-check with `ipconfig`) |

## What is NOT done (resume here)

1. Push local `master` to GitHub when you want this pairing work on the remote.
2. Phone browser check if the Wi‑Fi address changed: `http://<LAN-IP>:3001/health` (`http`, not `https`; not `localhost` on the phone).

---

## Fresh machine setup (copy-paste)

### Prerequisites

- Node.js **20+**
- Docker Desktop (running)
- Git
- Android Studio (only needed for the gateway app)
- npm 11+ recommended

### 1. Clone (already done on this PC)

```bash
git clone https://github.com/SparkxDating/cpaas.git
cd cpaas
```

On this Windows machine the clone is:

```text
C:\Users\manoj\cpaas
```

### 2. Env

```bash
cp .env.example .env
```

### 3. Infra + install + DB

```bash
docker compose up -d postgres redis minio minio-init mailhog
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
```

Seed prints a test API key (`sk_test_…`). Save it (optional; pairing codes do not need it).

### 4. Run services

```bash
npm run dev
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

Preferred pairing:

1. Dashboard → Gateways → **Generate pairing code**
2. Phone: API base = listed `http://<LAN-IP>:3001`
3. Paste code → **Pair with code** → **Start gateway service**

---

## Important notes

- **`.env` is not in git** (secrets). Always copy from `.env.example` on a new machine.
- **Local DB is not in git.** New machine = empty DB → run migrate + seed again.
- **LAN IP changes** per network/machine. Dashboard now lists this PC's IPv4s.
- API must listen on **0.0.0.0** (already set in `apps/api/src/main.ts`).
- Pairing codes expire in **10 minutes** and can be used once.

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

> Resume CPaaS from `C:\Users\manoj\cpaas`. Stack is running on Windows Postgres/Redis. Pairing code is committed on local master. Live SMS already succeeded.

---

*Updated 2026-09-21. Local API/dashboard are up; Android gateway paired; live SMS verified.*
