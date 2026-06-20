# APPIDO backend — start here

A complete, multi-tenant **AI Revenue-OS** backend for Telegram businesses, with deployment + CI/CD.

## What's in the box
- **services/core-api** — NestJS + Fastify API: auth (argon2, sessions, CSRF, throttle), CRM, products,
  payments (9 gateways), billing (Start/Pro + activation codes), AI agent/RAG/flywheel/eval, owner
  analytics, realtime (SSE, tenant-scoped), health/readiness, ops.
- **services/workers** — BullMQ workers (Telegram ingest, AI reply, payment-watch, growth) + transactional
  outbox relay + dead-letter queue.
- **packages/** — db (RLS, migrations 0000–0011, outbox), crypto (envelope encryption + rotation),
  payments, ai, analytics, authz, telegram, config, types.
- **deploy/** — Render / Fly / Kubernetes manifests + guide.
- **.github/** — CI, CD (GHCR image + SBOM + provenance + Trivy scan + gated deploy), CodeQL, Dependabot.
- **Docs** — LAUNCH.md, PRODUCTION-READINESS.md, E2E.md, SECURITY.md, RUN.md,
  APPIDO-BACKEND-ARCHITECTURE.md, AI-STRATEGY.md.

## Go live — the order
1. **LAUNCH.md** — `install → typecheck → build → migrate → seed → test → smoke` (your real gate).
2. **deploy/README.md** — push to a platform (Render recommended); set secrets; set `APP_DATABASE_URL`
   after the first deploy.
3. **E2E.md** — point the frontends at the API and run the end-to-end checks.
4. **PRODUCTION-READINESS.md** — confirm the remaining seams (email, KMS, gateway sandbox tests) before
   public launch.

## Two invariants the whole system enforces
- **MRR ≠ GMV**: Appido's subscription revenue (the `subscriptions` table) is never mixed with platform
  volume (the `transactions` table).
- **Tenant isolation**: PostgreSQL Row-Level Security via the `appido_app` (NOBYPASSRLS) role — always set
  `APP_DATABASE_URL` to that role.

## Honest status
The code is authored and **statically verified** in an offline environment — TypeScript syntax across
the whole tree, a strict typecheck on the payments package, JSON/YAML validity, the design-lint, and
digit checks. It has **not** been built, migrated, tested, or deployed here (no network/toolchain in the
authoring environment). **Your first CI run is the real gate** and will likely surface a few fixes. The
payment adapters follow each gateway's documented API and need a **sandbox test with real credentials**
before you enable them. The owner console's **Analytics** view is live-wired to the backend; the other
frontend surfaces render demo data until their HTTP layers are built (see E2E.md → "Next milestone").
