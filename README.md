# CPaaS — Open-Source Communications Platform as a Service

Enterprise-grade CPaaS foundation inspired by Twilio: **Verify, Messaging, Voice, Email, Webhooks, Billing, Provider Router, and Android SMS Gateway**.

## Architecture

```
apps/
  api          NestJS REST API (/v1/*) + Swagger + metrics
  worker       BullMQ workers (SMS, email, webhooks, voice, billing)
  dashboard    Customer console (Next.js 15)
  admin        Platform admin (Next.js 15)
  docs         Product / API docs site

packages/
  database     Prisma schema, client, seed, migrations
  auth         JWT, API keys, RBAC, Argon2, AES
  common       Shared types, errors, validation, money
  logger       Winston structured logging
  events       Domain event contracts + Redis pub/sub helpers
  sdk-js       Official Node.js SDK
  sdk-python   Python SDK
  sdk-go       Go SDK
  sdk-java     Java SDK
  sdk-php      PHP SDK

android/gateway   Kotlin SMS gateway app (device → CPaaS)

deploy/
  k8s          Kubernetes manifests
  prometheus   Scrape config
  grafana      Datasource provisioning
  otel         OpenTelemetry collector
```

## Resume on another machine

See **[`CONTINUE.md`](CONTINUE.md)** for handoff status, seed logins, LAN/phone checks, and Android gateway pairing steps.

Pair a phone from the customer dashboard (**Gateways** → generate a 10-minute pairing code) or with a project API key. Devices stay **PENDING** until the gateway service heartbeats, then **ONLINE**.

## Quick start (local)

### Prerequisites

- Node.js 20+
- Docker Desktop
- npm 11+

### 1. Infrastructure

```bash
cp .env.example .env
docker compose up -d postgres redis minio minio-init mailhog
```

### 2. Install & database

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 3. Run API + worker + dashboards

```bash
npm run dev
```

| Service    | URL                          |
|-----------|------------------------------|
| API       | http://localhost:3001        |
| Swagger   | http://localhost:3001/docs   |
| Metrics   | http://localhost:3001/metrics|
| Dashboard | http://localhost:3000        |
| Admin     | http://localhost:3002        |
| Mailhog   | http://localhost:8025        |
| MinIO     | http://localhost:9001        |
| Grafana   | http://localhost:3100        |

### Seed credentials

- **Admin:** `admin@cpaas.local` / `ChangeMeAdmin123!`
- **Developer:** `dev@cpaas.local` / `ChangeMeDev123!`
- **Test API key:** printed by seed (`sk_test_...`)

## Core API surface

```http
POST /v1/verify/send
POST /v1/verify/check
POST /v1/messages
POST /v1/calls
POST /v1/email/send
POST /v1/webhooks
POST /v1/device/pairing-codes
POST /v1/device/pair
POST /v1/device/register
```

Authenticate with:

```http
Authorization: Bearer <jwt>
# or
X-Api-Key: sk_live_xxxxx
```

## Android gateway

See [`android/gateway/README.md`](android/gateway/README.md). Devices register via:

```http
POST /v1/device/register
POST /v1/device/heartbeat
POST /v1/device/status
POST /v1/device/inbox
POST /v1/device/outbox
```

## Provider router

Priority path (configurable per project/route):

1. Online **Android Gateway** (lowest cost)
2. MSG91 → SpringEdge → Exotel → Twilio → Vonage → Plivo → TextBee

Selection uses country, cost, priority, health, and delivery success rates.

## Production

```bash
docker compose up -d --build
# or apply Kubernetes manifests
kubectl apply -f deploy/k8s/
```

## License

Apache-2.0
