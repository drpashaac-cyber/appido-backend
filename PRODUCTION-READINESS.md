# APPIDO backend — production readiness

An honest audit. Legend: **[done]** real and wired · **[seam]** real but needs config/credentials
before it does anything in production · **[todo]** not implemented yet.

## What is real and wired  [done]
- **API**: NestJS 11 + Fastify; Pino structured logs with secret redaction; helmet; CORS with credentials;
  global validation; exception filter; Swagger at `/docs`; graceful shutdown; OpenTelemetry hooks.
- **Tenant isolation**: PostgreSQL Row-Level Security enforced via a dedicated runtime role
  (`appido_app`, NOBYPASSRLS). Every tenant query runs inside `runWithRls`. Integration tests assert
  cross-tenant isolation.
- **Auth**: argon2 password hashing; email login codes + optional 2FA; server-side sessions in
  httpOnly cookies; CSRF double-submit guard; Redis-backed rate limiting.
- **Secrets**: multi-key envelope encryption (AES-GCM) of tenant gateway keys + bot tokens, with a
  proven rotation path.
- **Eventing**: transactional outbox + relay (no lost domain events); dead-letter queue + owner replay.
- **Workers**: BullMQ — Telegram ingest (atomic dedup), AI reply (budget-gated agent), payment-watch,
  growth (lead scoring / campaigns / attribution / eval / secret rotation).
- **AI**: tool-using RAG agent; per-tenant model choice; usage metering (micro-USD); flywheel outcome
  attribution; eval runner (LLM-judge, golden cases).
- **Payments**: ZarinPal, IDPay, NextPay, Stripe, PayPal + USDT (TRC20/BEP20/TON) behind one uniform
  adapter, with a generic gateway-return callback (verify is server-to-server), idempotent finalize,
  and Telegram access grant. Manual card-to-card is supported. MRR (Appido subscriptions) and GMV
  (platform volume) are kept strictly separate everywhere.
- **Billing**: Start ($79) / Pro ($179) + activation codes (race-safe single redemption).
- **Owner analytics**: MRR, GMV (by currency + daily series + top tenants), funnel, monthly cohorts,
  flywheel conversion — gated by `analytics:read`.
- **Realtime**: SSE stream **scoped to the authenticated session's tenant** (no more open `?channel=`).
- **Ops**: `/health` (liveness) + `/health/ready` (db + redis); Dockerfiles for api + workers; full
  docker-compose; CI that runs migrate + seed + typecheck + gated integration tests on Postgres + Redis.

## Configure before launch  [seam]
- **Email**: set `RESEND_API_KEY` + `EMAIL_FROM`. Without it the dev transport only logs codes — not
  acceptable for production login/2FA.
- **Secrets management**: `SECRETS_MASTER_KEY` is read from the environment. Recommended: source it from a
  managed secret store (AWS Secrets Manager / GCP Secret Manager / Vault). The rotation seam
  (`SECRETS_MASTER_KEYS` + `POST /v1/owner/secrets/rotate`) is in place.
- **LLM**: AI features are inert until `LITELLM_BASE_URL` + a provider key are set and the proxy is running.
- **Telegram**: each tenant brings its own bot token; the webhook must be reachable over HTTPS at `PUBLIC_BASE_URL`.

## Not implemented yet  [todo]
- All nine payment methods are now implemented (ZarinPal, IDPay, NextPay, Stripe, PayPal, USDT×3, manual
  card). Each new gateway still needs its own **sandbox test with real merchant credentials** before you
  enable it — the adapters are written to each gateway's documented API but have not been run against a
  live account here.
- **Automated DB backup/restore** and **alerting dashboards** are infra responsibilities, not in this repo.

## The overriding gate  ⚠️
This codebase has been authored and verified **statically** in an offline environment — TypeScript
syntax across the whole tree, real type-checks on dependency-light packages, JSON/YAML/SQL validity,
the design-lint, and digit checks. It has **not yet been `npm install`-ed, fully type-checked, built,
migrated, or test-run here**, because this environment has no network/toolchain access. That pass is
**required** before calling it deploy-ready and will likely surface fixes (cross-package type
mismatches, dependency versions, runtime config). Run the **LAUNCH.md gate** (install → typecheck →
build → migrate → seed → test → smoke) on real infrastructure; treat a green CI run as the go signal.

## Known risks / later work
- Analytics funnel + cohort use whole-table aggregates — fine at current scale; move to materialized
  rollups as data grows.
- No load test or penetration test yet; run `npm audit` and tune rate limits before public launch.
