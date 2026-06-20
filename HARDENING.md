# APPIDO — Hardening status (Item #2)

What a top-tier review checks, and where APPIDO stands. Split into: done-in-code, strong baselines
already present, and operational items that are process/infra (cannot be satisfied by code alone).

## Added in this pass (code, syntax-verified)
- **AI model currency (June 2026):** `infra/litellm/config.yaml` now targets Claude Sonnet 4.6 (default
  `claude` + smart tier), Claude Haiku 4.5 (`fast` tier), with a `claude-opus` alias for Opus 4.8 (top
  widely-available model; Fable 5 / Mythos 5 are export-suspended). gpt/gemini kept with confirm-at-deploy
  notes. Model IDs live in one place — bump there as providers release newer pins.
- **Prompt caching:** the long, stable system/guardrail prefix is sent with `cache_control: ephemeral` on
  Anthropic-backed models (gated by logical model name so gpt/gemini are untouched). Cuts cost + latency
  per turn. **Verify the cache-hit in staging** (watch `usage` cache fields) — not exercised offline.
- **DB pool tuning:** runtime pool is env-tunable (`DB_POOL_MAX`, `DB_POOL_IDLE_MS`,
  `DB_POOL_CONN_TIMEOUT_MS`), `keepAlive` on, and a pool `error` handler so a dropped backend connection
  never crashes the process.
- **Reply UX:** the bot sends a "typing…" chat action before generating (best-effort, never blocks).

## Strong baselines already present (verified by inspection)
- **Tenant isolation:** PostgreSQL RLS via a NOBYPASSRLS role; every runtime query runs under
  `runWithRls`. Platform tables are explicitly platform-scoped.
- **Rate limiting:** `@nestjs/throttler` as a global guard, **Redis-backed so limits are shared across
  instances** (300 req/min default), tighter per-route limits on auth + public AI, and the Telegram
  webhook correctly skips throttling (provider retries).
- **AuthN/Z:** argon2 password hashing, httpOnly session cookie + CSRF double-submit, permission guard
  (`platform:overview` etc.), self-serve registration throttled.
- **Secrets:** envelope encryption of tenant gateway keys + bot tokens; master-key rotation supported
  (`SECRETS_MASTER_KEYS`).
- **AI cost control:** per-tenant usage metering + month-to-date budget guard on every AI path; hybrid
  fast/smart routing so only high-intent/VIP escalate.
- **Reliability:** idempotent Telegram webhook (constant-time secret check), BullMQ workers with a
  dead-letter surface + replay, nightly retention/erasure job, readiness probe checks DB + Redis.
- **Observability:** OpenTelemetry auto-instrumentation (traces, when `OTEL_EXPORTER_OTLP_ENDPOINT` set)
  + structured JSON logging (pino).
- **Supply chain:** CI runs `npm audit` (high) + CodeQL; strict TypeScript, zero `any`.

## Operational items — process/infra, NOT code (own these before/at scale)
These are what remain for a "no-reservations" sign-off. They cannot be implemented from the app repo:
1. **Backups + DR:** enable managed-Postgres PITR (point-in-time recovery); document RPO/RTO; rehearse a
   restore. Snapshot Redis only if you rely on it for durable state (here it's cache/queue — re-derivable).
2. **Load + soak test:** drive realistic Telegram traffic (k6/Gatling) to size `DB_POOL_MAX`, replica
   count, and LiteLLM throughput; confirm the budget guard + throttler behave under burst.
3. **Security review:** third-party pentest of the auth/session/CSRF/RLS surface; verify cross-subdomain
   cookie scoping in real browsers; add a CSP (currently relaxed) once asset origins are fixed.
4. **Secrets at rest:** move `SECRETS_MASTER_KEY` into a managed KMS/secret store; set a rotation schedule.
5. **SLOs + alerting:** wire the OTLP endpoint to your APM; alert on error rate, p95 latency, queue depth,
   AI spend, and DB saturation. Define on-call + a runbook.
6. **Staging gate:** run the full e2e smoke incl. Tier C (Telegram + a test bot + AI keys) against staging
   before each production promote (see SMOKE.md).

## Honest bottom line
The code baseline is strong and current. "Optimal enough that a hard CTO panel signs off" additionally
requires the operational items above — they are deployment + process work, validated against real infra,
not further edits to this repo.
