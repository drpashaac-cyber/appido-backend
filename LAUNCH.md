# APPIDO backend — launch runbook

Everything needed to take this monorepo from source to a running, deployed backend. Follow the
**gate** in order; do not skip steps. The single source of truth for env vars is `.env.example`.

## 0. Prerequisites
- Node.js 20.x, npm 10.x
- PostgreSQL 16 with the `pgvector` and `pgcrypto` extensions
- Redis 7
- (For AI) a reachable LiteLLM proxy + provider API key(s)
- Docker + Docker Compose (for the container path)

## 1. Configure
```bash
cp .env.example .env
```
Fill in at minimum:
- `DATABASE_URL` (superuser/owner — used for migrations + seed)
- `APP_DATABASE_URL` (runtime role `appido_app`, NOBYPASSRLS — created by migration 0001; this is what enforces tenant isolation)
- `REDIS_URL`
- `SECRETS_MASTER_KEY` (>= 32 bytes — envelope-encrypts tenant gateway keys + bot tokens)
- `OWNER_EMAIL` (the primary platform owner)
- `PUBLIC_BASE_URL` (the externally reachable HTTPS URL)
- `RESEND_API_KEY` + `EMAIL_FROM` (so login/2FA codes are emailed — without it, codes only log to the console)
- For production cookies: `COOKIE_SECURE=true`, `COOKIE_DOMAIN=.appido.io`, `CORS_ORIGINS=https://www.appido.io,...`
- For AI: `LITELLM_BASE_URL`, `LITELLM_MASTER_KEY`, and `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY`
- For Appido's own subscription gateway (MRR): `APPIDO_PAY_METHOD` + `APPIDO_PAY_SECRET`
- For USDT confirmations: `TRON_API_KEY` / `BSCSCAN_API_KEY` / `TON_API_KEY`

## 2. The gate (run in order — each must pass)
```bash
npm install
npm run typecheck        # full monorepo TypeScript (strict) — FIRST real compile of the whole tree
npm run build            # turbo build of every package + service
npm run migrate          # applies migrations 0000–0011 (uses DATABASE_URL)
npm run seed             # optional: demo/owner bootstrap
npm test                 # unit + gated integration tests (need DATABASE_URL + APP_DATABASE_URL + REDIS_URL)
```
> The integration tests are the real behavioural gate (RLS isolation, payment finalize, billing
> activation, flywheel attribution, outbox, DLQ, analytics). They run in CI (`.github/workflows/ci.yml`)
> against real Postgres + Redis. Run them locally too before first deploy.

## 3. Run
Local (two processes):
```bash
node services/core-api/dist/main.js     # API on PORT (default 8080)
node services/workers/dist/main.js      # BullMQ workers + outbox relay
```
Container (full stack — Postgres, Redis, LiteLLM, migrate, api, workers):
```bash
docker compose up --build
```

## 4. Verify (smoke)
```bash
BASE_URL=https://api.appido.io npm run smoke
```
Checks: `GET /health` (liveness), `GET /health/ready` (db + redis reachable), and that a protected
route returns 401 without a session. API docs (Swagger) are at `/docs`.

## 5. Production notes
- **TLS**: terminate HTTPS in front (the app speaks HTTP); set `PUBLIC_BASE_URL` to the public HTTPS URL.
- **Cookies**: `COOKIE_SECURE=true` + `COOKIE_DOMAIN` + correct `CORS_ORIGINS` (the frontends send `credentials: include`).
- **Workers**: scale horizontally; concurrency is set per queue in `services/workers`. The outbox relay
  and repeatable jobs (payment scan /60s, flywheel attribution /24h) are safe to run on multiple instances.
- **Postgres**: managed instance with `pgvector`; enable automated backups + PITR.
- **Redis**: enable persistence (throttling + queues + pub/sub depend on it).
- **Secrets rotation**: add a new key to `SECRETS_MASTER_KEYS` (comma-separated), deploy, then
  `POST /v1/owner/secrets/rotate` re-encrypts all stored secrets to the new primary.
- **Observability**: set `OTEL_EXPORTER_OTLP_ENDPOINT`; logs are structured JSON (Pino) with secret redaction.

## 6. Rollback
Migrations are forward-only. Always snapshot the database before `npm run migrate`. To roll back a
release, redeploy the previous image/commit; restore the DB snapshot only if a migration must be undone.

## 7. Hosted deployment (Render / Fly / Railway / Kubernetes)
Ready-to-use configs live in `deploy/` — see `deploy/README.md`:
- `deploy/render.yaml` — Render Blueprint (API + workers + Postgres + Key Value) — recommended.
- `deploy/fly/fly.toml` — Fly.io (one image, two process groups, `release_command` migrate).
- `deploy/k8s/*.yaml` — Kubernetes (Deployments + Service + Ingress + HPA + migrate Job + Secret template).
- Railway notes in `deploy/README.md`.
The same Docker image runs both the API (default CMD) and the workers (overridden start command).
