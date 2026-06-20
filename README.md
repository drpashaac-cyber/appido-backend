# APPIDO Backend (monorepo)

One backend for the three APPIDO surfaces (landing, tenant dashboard, owner console).
Modular monolith · `tenant_id` + Postgres RLS on every table · observability + realtime from day one.

```
packages/
  config/   env loading + validation (zod), single source of truth
  db/        Drizzle ORM + Postgres client + SQL migration runner
  types/     shared cross-surface types (Api contract, realtime events)
services/
  core-api/  NestJS + Fastify — HTTP API, health, realtime (SSE), DI for db/redis
  workers/   BullMQ consumers (tg-ingest, ai-reply, payment-watch, … as phases land)
infra/
  litellm/   AI gateway config (Claude / GPT / Gemini, central provider keys)
docker-compose.yml   postgres(+pgvector) · redis · litellm · core-api · workers
```

This is **P10 (owner analytics)** on top of P0–P9: platform dashboards for MRR (Appido subscription revenue), GMV (platform volume — by currency, daily series, top tenants), the customer funnel, monthly cohorts, and the AI conversion rate from the flywheel — owner-gated read-only aggregates that keep MRR and GMV strictly separate.
Run instructions: `RUN.md`.
