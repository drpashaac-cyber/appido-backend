# Run — Phase 0

## Prerequisites
- Node 20+ (`nvm use`)
- Docker + Docker Compose

## A. Everything in Docker (matches the P0 acceptance test)
```bash
cp .env.example .env        # adjust if needed; add provider keys when you have them
docker compose up --build   # postgres + redis + litellm + core-api + workers
# in another shell, run the DB migration once the db is healthy:
docker compose exec core-api node packages/db/dist/migrate.js   # or: npm run migrate (locally)
```
Verify:
```bash
curl localhost:8080/health         # {"status":"ok",...}        (liveness)
curl localhost:8080/health/ready   # {"status":"ok","db":true,"redis":true}
# live stream (SSE): open in a browser / curl -N
curl -N "localhost:8080/realtime/stream?channel=demo"
```

## B. Local dev (Node) with Docker only for data
```bash
npm install
docker compose up postgres redis litellm -d
cp .env.example .env
npm run build          # turbo builds all workspaces in order
npm run migrate        # applies packages/db/migrations/*.sql
npm run typecheck      # strict TS across the monorepo
npm test               # vitest
# run the two services:
npm run dev -w @appido/core-api      # http://localhost:8080
npm run dev -w @appido/workers
```

## Notes
- The AI gateway (LiteLLM) holds APPIDO's central provider keys, so AI is active with **zero tenant setup**. Add `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` to `.env` when ready; the gateway boots without them (models simply won't answer until keys exist).
- `npm install` generates the lockfile on first run; CI then uses it.
- Auth is **not** in P0 — the realtime stream is scoped by `?channel=` as a placeholder and is replaced by the authenticated session in P1.

---

# Phase 1 — Identity & tenancy (auth + RLS)

`docker compose up --build` is now **turnkey**: a one-shot `migrate` service runs the
migrations + seeds the owner before `core-api`/`workers` start.

## Sign in as the platform owner (passwordless email-code, per BACKEND.md §3)
```bash
# 1) request a login code for the seeded owner
curl -s -X POST localhost:8080/auth/login/start \
  -H 'content-type: application/json' -d '{"email":"appido.co@gmail.com"}'
# 2) read the code from the logs (dev email transport):
docker compose logs core-api | grep "login code"
# 3) exchange it for a session cookie:
curl -s -c cookies.txt -X POST localhost:8080/auth/login/code \
  -H 'content-type: application/json' -d '{"email":"appido.co@gmail.com","code":"<CODE>"}'
# 4) who am I + RLS-scoped data:
curl -s -b cookies.txt localhost:8080/me        # {id,email,role:"owner",tenantId,...}
curl -s -b cookies.txt localhost:8080/channels  # platform sees all; a tenant sees only its own
```

## Auth surface
- `POST /auth/login/start { email }` → neutral `{ ok:true }` (no account enumeration; sends a code for code-method users)
- `POST /auth/login/password { email, password }` → sets session cookie, or `{ next:"twofa" }` then `…/login/code`
- `POST /auth/login/code { email, code }` → sets session cookie
- `POST /auth/logout` · `POST /auth/password/rotate { newPassword }` (for owner-set temporary passwords)
- `GET /me` (auth required) · `GET /session`

## Row-Level Security
- The app connects as **`appido_app`** (`NOBYPASSRLS`); migrations/seed run as the superuser.
- Every tenant query goes through `runWithRls(pool, ctx, fn)` → `SET LOCAL app.tenant_id / app.platform` inside a transaction; Postgres policies enforce isolation at the DB layer (`channels` now; all P2 domain tables follow the same pattern).
- Verified by `services/core-api/test/rls.int.test.ts` (runs in CI; locally needs `DATABASE_URL` + `APP_DATABASE_URL`).

## Notes
- Email is a dev transport (logs the code). A real provider (Resend/SES/SMTP) lands in P5/P7.
- `COOKIE_SECURE=true` in production (HTTPS); set `COOKIE_DOMAIN=.appido.io` to share the session across `/os`, `/os/dashboard`, `/os/owner`.

---

# Phase 2 — Data plane & HttpApi

Full domain schema + RLS + a demo tenant (`Acme Coaching`) so both consoles render
real, live data. Interactive contract at **`/docs`** (OpenAPI/Swagger).

```bash
docker compose up --build      # migrate (0000–0002) + seed run automatically
# sign in as the demo tenant manager (code in logs), then:
curl -b c.txt localhost:8080/v1/dashboard/summary
curl -b c.txt "localhost:8080/v1/customers?limit=25"
curl -b c.txt localhost:8080/v1/products
curl -b c.txt "localhost:8080/v1/transactions?limit=25"
curl -b c.txt localhost:8080/v1/usage
# owner aggregate (sign in as appido.co@gmail.com):
curl -b c.txt localhost:8080/v1/owner/overview
# landing funnel event (public):
curl -X POST localhost:8080/api/track -H 'content-type: application/json' -d '{"name":"hero_cta_click"}'
```

Frontend wiring: **`integration/INTEGRATION.md`** + drop-in **`integration/httpApi.ts`**.

Modern principles applied this phase: money as integer minor units (no floats),
keyset pagination (no OFFSET), DTO validation (`class-validator` + global `ValidationPipe`),
OpenAPI docs, consistent error envelope, API versioning (`/v1`), audit service for mutations,
and a hard MRR≠GMV / Appido-sub≠tenant-product separation in the schema.

---

# Phase 3 — Telegram connect & ingest

Turnkey BYO-bot: the tenant pastes their bot token; the platform verifies it,
stores it **AEAD-encrypted**, registers a **secret-token-protected webhook**, and
ingests every message into the CRM (inbox + timeline) live over SSE.

```bash
# Telegram must reach your webhook over HTTPS — expose the API with a tunnel in dev:
#   ngrok http 8080   →   export PUBLIC_BASE_URL=https://<id>.ngrok-free.app
docker compose up --build      # migrate 0000–0003 + seed run automatically

# sign in as the demo tenant manager (manager@acme.test; code in `docker compose logs core-api`)
curl -sX POST localhost:8080/auth/login/start -H 'content-type: application/json' -d '{"email":"manager@acme.test"}'
curl -sX POST localhost:8080/auth/login/code  -c c.txt -H 'content-type: application/json' \
  -d '{"email":"manager@acme.test","code":"<CODE_FROM_LOGS>"}'

# verify a bot token (BotFather), then connect it
curl -sb c.txt -X POST localhost:8080/v1/telegram/verify-token -H 'content-type: application/json' \
  -d '{"token":"123456789:AA...your-bot-token..."}'
curl -sb c.txt -X POST localhost:8080/v1/telegram/connect -H 'content-type: application/json' \
  -d '{"token":"123456789:AA...your-bot-token...","name":"My Shop Bot"}'
# → { channelId, webhookUrl, ok:true, botUsername }

# now DM your bot on Telegram, then watch it land in the CRM:
curl -sb c.txt "localhost:8080/v1/inbox?limit=10"
curl -sb c.txt localhost:8080/v1/telegram/status/<channelId>

# live stream (messages push within ~1s):
curl -N "localhost:8080/realtime/stream?channel=11111111-1111-1111-1111-111111111111"
```

**Security & correctness:** bot tokens encrypted at rest (AES-256-GCM; KMS-swappable),
webhook authenticated via `X-Telegram-Bot-Api-Secret-Token` (constant-time compare → 403),
fast 2xx + async BullMQ processing, and **idempotent ingest** (dedup by `update_id`).

---

# P3.5 — Foundation Hardening

Architectural seams that keep Appido a Business OS (not just a CRM), added before
they become painful migrations. No engines built — just the cheap, future-proof seams.

**1. Customer-360 identity graph** — `customer_identities` maps one canonical
customer to many channel identities (telegram/email/phone/web/whatsapp). Telegram
ingest now routes through `resolveCustomer()`; new channels become additive.

**2. Open event taxonomy** — `events.type` is now `text` (was a rigid enum) with an
open registry (`EVENT_TYPES` in `@appido/types`). New business/workflow events
(`campaign_opened`, `link_clicked`, `lead_scored`, …) need no migration. This is the
analytics + future workflow-trigger backbone.

**3. Locale / region fields** — tenants carry `country`, `timezone`, `locale`,
`currency`; customers carry `locale` (auto-filled from Telegram `language_code`).
Money already carries currency. Multi-region *infrastructure* remains deferred.

**4. Permission seam (RBAC now, ABAC later)** — `@appido/authz` defines a capability
catalog + role→permission map + `can(actor, permission, resource?)`. `GET /me` now
returns the caller's `permissions[]` so the frontends can gate UI (API-first). The
owner overview is migrated to `@RequirePermissions("platform:overview")` as the
exemplar; other endpoints migrate off `@Roles` incrementally.

```bash
docker compose up --build      # migrate 0000–0004 + seed
curl -b c.txt localhost:8080/me        # → { ..., permissions: ["customers:read", ...] }
```

---

# P3.6 — Correctness, reliability & security hardening

Pre-P4 fixes found in a code audit (not gold-plating — real issues):

- **Atomic ingest** — the Telegram dedup insert now runs *inside* the processing
  transaction, so a mid-processing failure rolls back the dedup and the job
  reprocesses cleanly. No lost or double-counted messages.
- **Job retries** — `tg-ingest` jobs now retry (5 attempts, exponential backoff),
  so transient DB/Redis blips and first-contact identity races self-heal.
- **Rate limiting** — global 300/min per IP (`@nestjs/throttler`); login endpoints
  10/min (brute-force defense); `/api/track` 60/min; the Telegram webhook is exempt
  (`@SkipThrottle`) since it is authenticated by its secret token and Telegram bursts
  from shared IPs would false-trigger a limiter.

Appropriately deferred (in the backlog, not needed yet): CSRF tokens (sameSite=lax is
the current mitigation), DLQ/outbox, Redis-backed distributed throttle, secret rotation.

---

# P4 — AI Core

One central, provider-abstracted AI service (`@appido/ai` over LiteLLM) used by every
surface — never per-feature LLM calls. A tool-using RAG agent sells & supports in the
Telegram DM; the same tools are the **Action Registry** the workflow engine (P6) reuses.

**Pieces**
- `@appido/ai` — `LiteLlmClient` (OpenAI-compatible), grounded prompt + guardrails,
  RAG (`chunk → embed → pgvector cosine`), the 7-tool agent loop
  (`get_product, search_knowledge, create_checkout_link, grant_access, tag_customer,
  set_intent, escalate`), and token metering with an estimated per-tenant cost.
- **Telegram loop** — `tg-ingest` enqueues `ai-reply`; the `ai-reply` worker runs the
  agent and replies in the customer's DM (skips when AI is off, the customer is
  human-handled, or the tenant is over budget).
- **Dashboard endpoints** (`/v1/ai/*`, permission-gated):
  `GET/PUT config` (model/tone/goal/languages/guardrails/enabled),
  `GET/POST knowledge` (RAG ingest), `POST advisor` (server-side SalesAdvisor —
  replaces the old client-side Anthropic call), `POST test` (dry-run playground).
- **Budget** — per-tenant `ai_budget_cents` enforced from our `ai_usage` ledger
  (month-to-date). LiteLLM virtual keys per tenant remain a documented scale-up.

```bash
# requires the provider keys in .env: ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY
docker compose up --build           # litellm + migrate 0000–0005 + seed
# index some knowledge, then preview the agent:
curl -b c.txt -X POST localhost:8080/v1/ai/knowledge -H 'content-type: application/json' \
  -d '{"source":"file","text":"Refunds within 7 days. VIP includes weekly calls."}'
curl -b c.txt -X POST localhost:8080/v1/ai/test -H 'content-type: application/json' \
  -d '{"message":"do you offer refunds? whats the vip price?"}'
# real end-to-end: DM the connected bot → the agent replies in Telegram.
```

---

# P4.5 — Managed Hybrid (cost & data-moat seams)

Decision: route across *hosted* models (frontier for hard reasoning, cheap `fast` tier for
high-volume simple tasks) + gateway caching + RAG. No self-hosted GPUs yet — deferred
behind a measured volume trigger; the gateway makes that a one-line config change. Full
rationale + staged roadmap in `AI-STRATEGY.md`.

Cheap seams added now (so no expensive retrofit later):
- **Model tiers** (`fast` / `smart` / `embed`) + **`AiTask`** routing in `@appido/ai` —
  cost/quality policy lives in one place. Tenant chat uses the tenant's chosen model;
  internal/batch tasks default to `fast`.
- **LiteLLM** — added a cheap `fast` model, Redis response caching, and a commented
  `local` (vLLM/Ollama) entry ready to flip on at Stage 1.
- **Flywheel logging** — `ai_usage` now records `task`, `tier`, `latency_ms`, `outcome`
  (migration 0006): the dataset for eval-gated, periodic distillation later.

Not done now (correctly deferred, with numeric triggers): self-hosted GPUs, fine-tuning,
semantic cache, the eval runner. See `AI-STRATEGY.md` stages 1–3.

---

# P5a — Payments: customer → tenant (GMV)

The AI agent can now actually sell. A `PaymentProvider` adapter (`@appido/payments`) bills
the customer through the **tenant's own** encrypted gateway keys, records a GMV transaction,
and grants Telegram access on confirmation.

- **Providers** — ZarinPal v4 (redirect: request → StartPay → verify), on-chain **USDT**
  watchers (TRC20/BEP20/TON), and manual. Same interface for idpay/nextpay/stripe/paypal/card
  (added later).
- **`create_checkout_link`** (AI tool) — now creates a real pending transaction and returns
  the gateway redirect URL or the crypto pay address/amount/memo.
- **Confirmation paths** — ZarinPal returns to `GET /pay/callback/:txId` (public) → verify →
  finalize; the `payment-watch` worker polls pending crypto every 60s → finalize; tenants can
  confirm offline payments via `POST /v1/payments/transactions/:id/confirm`.
- **finalize** (idempotent) — marks the transaction `ok`, records the sale (`paid` event),
  creates a one-time group invite, DMs it to the customer (`access_granted`), and publishes
  `payment.confirmed`.
- **Tenant gateway keys** — `GET/POST/PATCH/DELETE /v1/payments/credentials` (tenant_admin),
  secrets AES-GCM encrypted at rest; list never returns the secret.
- **Separation kept** — these are GMV (`transactions`). Appido subscription revenue (MRR) is
  P5b and never touches this table.

Env for confirmation: `PUBLIC_BASE_URL` (callback), and central chain-read keys
`TRON_API_KEY` / `BSCSCAN_API_KEY` / `TON_API_KEY` (Appido holds these; tenants provide only
their wallet address).

---

# P5b — Appido subscription billing (MRR) + activation codes

Appido's OWN revenue, fully separate from GMV: it lives in `subscriptions` and uses
APPIDO's central gateway (config), never a tenant's keys, never the `transactions` table.

- **Plans** (`@appido/payments`): Start $79/mo, Pro $179/mo (`APPIDO_PLANS`).
- **Subscription checkout** — `POST /v1/billing/checkout {plan}` (tenant_admin) charges via
  Appido's gateway (`APPIDO_PAY_METHOD` + `APPIDO_PAY_SECRET`), creates a `past_due`
  (awaiting) subscription, returns the redirect/crypto details. `GET /pay`-style return at
  `GET /billing/callback/:subscriptionId` (public) → verify → activate (`active`, +30d).
- **Activation codes** — owner/finance mint + list via `POST/GET /v1/owner/activation-codes`
  (`billing:manage`); tenants redeem with `POST /v1/billing/redeem {code}`. Codes table is
  **platform-only RLS** (tenants can't enumerate); redemption claim is race-safe (conditional
  update). Great for Founder-Led-Sales / resellers / comps.
- **`GET /v1/billing/subscription`** — the tenant's current active plan + the price list.
- **Separation** — MRR only. Tenant→customer sales (GMV) stay in P5a's `transactions`.

Config: `APPIDO_PAY_METHOD` (default zarinpal), `APPIDO_PAY_SECRET` (JSON, e.g.
`{"merchantId":"..."}` for ZarinPal or `{"address":"T..."}` for USDT). Without it, the gateway
checkout returns 503 but activation codes still work.

---

# P6 — Growth / automation engine (the "Revenue OS" core)

Turns leads into revenue automatically, on top of the CRM + the P4.5 tiered AI.

- **Lead scoring** — `POST /v1/growth/score` enqueues a `score-leads` job. The worker reads
  each customer's profile + recent events and scores purchase intent on the cheap **`fast`**
  tier, writing `customers.intent` (0-100), `tag` (hot/warm/cold), and `tags`; emits a
  `scored` event; budget-guarded + metered (flywheel: `ai_usage.task='score_lead'`).
- **Lead finding** — `GET /v1/growth/leads?minScore=` returns customers ranked by intent
  (highest-value leads first).
- **Segments** — reusable targeting criteria (`GET/POST/DELETE /v1/growth/segments`).
  Column-based criteria: `minScore/maxScore`, `minLtvCents/maxLtvCents` (e.g. `maxLtvCents:0`
  = never purchased), `isVip`, `tag`.
- **Campaigns** — `POST /v1/growth/campaigns` (draft) → `POST .../:id/copy` generates copy on
  the **`smart`** tier → `POST .../:id/send` enqueues a `run-campaign` job. The worker resolves
  the segment, broadcasts via the tenant's bot (~20 msg/s, one retry on transient/429),
  records per-recipient `campaign_sends` + `campaign_sent` events + live `campaign.sent`.
- **Retargeting** = a campaign over a cold/non-buyer segment (e.g. `{maxScore:50,maxLtvCents:0}`)
  — same pipeline, no separate code.
- Tables: `segments`, `campaigns`, `campaign_sends` (migration 0009, tenant-isolation RLS).
  Tenant-facing endpoints are `tenant_admin`.

Deferred (with clear seams): event-based criteria (last-active/has-paid via subqueries),
scheduled/recurring campaigns, A/B variants, per-recipient outcome attribution back into
`ai_usage.outcome` for the training flywheel.

---

# P7 — Flywheel: outcome attribution + eval-runner

Closes the improvement loop so the AI gets measurably better over time — safely (eval-gated,
not live self-retraining).

- **Attribution** (nightly, idempotent) — `attributeOutcomes`: for recent `paid` events it
  sets `ai_usage.outcome='converted'` on that customer's preceding AI interactions (chat,
  lead-score) within a 14-day window and marks the converting `campaign_sends.converted_at`;
  interactions whose window elapsed with no conversion become `no_conversion`. Result: a real
  labeled dataset (positives + negatives). Scheduled on the growth queue (`flywheel-attribute`).
- **Tenant view** — `GET /v1/flywheel` (tenant_admin): per-task conversion rate
  (`converted / (converted + no_conversion)`) — "is the AI actually converting?".
- **Eval-runner** — owner curates `golden_cases` per task (`GET/POST /v1/owner/golden-cases`,
  `platform:overview`); `POST /v1/owner/evals/run {task,model?}` enqueues a `run-eval` job that
  runs each case through the model and scores output vs expected with an LLM judge (smart tier),
  persisting `eval_runs`; `GET /v1/owner/evals` lists results.
- Tables (migration 0010): `golden_cases`, `eval_runs` (platform-only RLS); `campaign_sends`
  gains `converted_at`; `ai_usage` gains a `customer_id` index for attribution.
- Note: P6's lead-score no longer writes its prediction into `outcome` — `outcome` is now the
  downstream result only.

---

# P8 — Production hardening

Five independent hardening items.

**1. CSRF (double-submit).** A global `CsrfGuard` enforces CSRF only for cookie-authenticated,
state-changing requests: a readable `appido_csrf` cookie (set at login, re-issuable via
`GET /auth/csrf`) must equal the `X-CSRF-Token` header. Safe methods, requests with no session
cookie, and `@SkipCsrf()` routes (Telegram webhook, public pay/billing callbacks, `/api/track`)
pass through. `SameSite=lax` on the session cookie is the first line; the token is the second.

**2. Rate limiting on Redis.** `ThrottlerModule` now uses `ThrottlerStorageRedisService`
(shared across instances) instead of per-process memory — global 300/min, with the tighter
per-route limits from P3.6 still applied. Requires `@nest-lab/throttler-storage-redis`.

**3. Secret-key rotation (no downtime).** `SecretCipher` accepts a key list: `keys[0]` encrypts;
all keys are tried on decrypt (a wrong key fails the GCM auth tag, so we fall through). Rotate by
deploying the new key as `SECRETS_MASTER_KEY` and the old one(s) in `SECRETS_MASTER_KEYS`
(comma-separated), then `POST /v1/owner/secrets/rotate` runs a sweep that re-encrypts every
stored secret (gateway creds, bot tokens, AI virtual keys) under the new primary; finally drop
the old key. `reEncrypt()` returns null for values already under the primary (idempotent).

**4. Transactional outbox.** Durable events (`payment.confirmed`, `subscription.updated`) are
written to an `outbox` row in the SAME DB transaction as the state change (`emitEvent(tx, …)`),
then a relay loop in the worker (`relayOutbox`, every 2s) publishes them to Redis at-least-once
and marks them published. Direct `realtime.publish` was removed from the payment/billing paths —
the relay is now the single delivery path for these events, so a crash between commit and publish
can no longer lose a money event. Ephemeral UI pings (message.created, etc.) stay direct.

**5. Dead-letter queue.** When a BullMQ job exhausts its retries, the worker's `failed` handler
writes a `dead_letters` row (queue, job name, payload, error). Owner endpoints:
`GET /v1/owner/dead-letters`, `POST /v1/owner/dead-letters/:id/replay` (re-enqueues to the
original queue, stamps `replayed_at`).

Tables (migration 0011): `outbox` (tenant-isolation RLS), `dead_letters` (platform-only RLS).
New config: `SECRETS_MASTER_KEYS` (optional). New dep: `@nest-lab/throttler-storage-redis`.

---

# P9 — Integration test expansion

The gated integration suite (each file skips unless `DATABASE_URL` + `APP_DATABASE_URL` are set;
the DLQ test also needs `REDIS_URL` — CI sets all three) now covers, beyond the existing RLS +
identity tests:

- **payments.int.test.ts** — `finalizeTransaction` confirms a pending tx (status→ok), records the
  `paid` event, and writes a `payment.confirmed` **outbox** row in the *same* transaction;
  idempotent re-finalize; cross-tenant isolation.
- **billing.int.test.ts** — `activateSubscription` creates an active subscription +
  `subscription.updated` outbox; an activation code redeems **exactly once** (race-safe).
- **growth.int.test.ts** — segments / campaigns / campaign_sends are tenant-isolated under RLS.
- **flywheel.int.test.ts** — `attributeOutcomes` marks a recent interaction `converted` after a
  `paid` event, ages an out-of-window one to `no_conversion`, and stamps the converting campaign
  send; `flywheelStats` reports the conversion. (End-to-end proof the loop closes.)
- **outbox.int.test.ts** — `emitEvent` + `relayOutbox` publish each event once and mark it
  published; a second relay re-publishes nothing (idempotent).
- **dlq.int.test.ts** — a job that exhausts retries lands in `dead_letters`; replay re-enqueues
  the payload to a queue that succeeds, then stamps `replayed_at`.

All run via `npm test` (Vitest). The `appido_app` role (LOGIN, **NOBYPASSRLS**) is what makes the
RLS assertions meaningful — a bypass role would make them pass vacuously.

---

# P10 — Owner analytics dashboards

Platform (cross-tenant) read-only aggregates for the owner console, gated by `analytics:read`
(owner / finance / marketer). **MRR (Appido subscription revenue) and GMV (platform volume) are
reported separately and never conflated.** Endpoints under `/v1/owner/analytics`:

- **GET overview** — headline: MRR cents, active subscribers, GMV (30d by currency), total
  customers, paid customers, overall AI conversion rate.
- **GET mrr** — each tenant's *latest* active subscription counted once (renewals never
  double-counted), broken down by plan + a status breakdown (active/trialing/past_due/canceled).
- **GET gmv?days=30** — successful transactions by currency (never summed across currencies),
  a daily time series, and the top tenants by volume.
- **GET funnel** — customers → engaged (any event) → scored (intent>0 or a `scored` event) →
  paid, with stage-to-stage conversion %.
- **GET cohorts?months=6** — monthly customer-acquisition cohorts (by `created_at`) and their
  conversion (a `paid` event), with per-cohort rate.
- **GET conversion** — platform-wide flywheel conversion by task —
  `converted / (converted + no_conversion)` from `ai_usage.outcome` (the P7 attribution data).

Aggregates live in the testable `@appido/analytics` package; `analytics.int.test.ts` seeds an
active Pro subscription + a paid USD transaction + a converted interaction and asserts the
dashboards reflect them (lower-bound assertions, robust to concurrent test data). Note:
funnel/cohort use whole-table aggregates — fine for an owner console; add materialized rollups
if data volume grows large.

---

# P12 — All payment gateways

The provider factory now covers every `PayMethod` behind the uniform `PaymentProvider` interface
(`createCheckout` + `verify`): **ZarinPal, IDPay, NextPay, Stripe, PayPal**, USDT (TRC20/BEP20/TON),
and manual **card** (card-to-card, confirmed by the tenant). A single generic gateway-return endpoint
(`GET /pay/callback/:transactionId`) handles all redirect gateways: it loads the tenant's own
credential, runs the gateway's server-to-server `verify`, and finalizes idempotently on confirmation.

Tenant gateway secrets (set via the dashboard, stored envelope-encrypted) per method:
- ZarinPal `{ merchantId, sandbox? }` · IDPay `{ apiKey, sandbox? }` · NextPay `{ apiKey }`
- Stripe `{ secretKey }` · PayPal `{ clientId, clientSecret, sandbox? }`
- USDT `{ address }` · card `{ cardNumber, holder }`

`packages/payments/src/factory.spec.ts` asserts a provider is built for every method. The adapters
follow each gateway's documented API and **must be sandbox-tested with real credentials before going
live** — they have not been exercised against a live account. Note the IRR-unit caveats on ZarinPal /
IDPay / NextPay (price those products in the unit your merchant account expects).
