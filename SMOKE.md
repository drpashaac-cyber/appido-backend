# APPIDO smoke test (`scripts/smoke.mjs`)

End-to-end verification of the launch-critical HTTP path against a RUNNING backend. It uses a real
cookie jar + CSRF, so it proves auth/session/RLS — not just that routes exist.

## Tiers
- **A — core** (always): health, readiness, auth guard (401), public reads (`/v1/plans`, `/v1/settings`),
  tenant self-serve (`/auth/csrf` then `/auth/register` then `/me`) and every dashboard read
  (`/v1/products`, `/v1/customers`, `/v1/dashboard/summary`, `/v1/usage`, `/v1/inbox`,
  `/v1/payments/methods`, `/v1/governance`, `/v1/ai/script`).
- **B — owner** (when `OWNER_EMAIL` + `OWNER_PASSWORD` set): owner login + the five console data
  endpoints (`/v1/owner/overview`, `/tenants`, `/analytics/{mrr,gmv,funnel}`, `/leads`) and asserts the
  just-registered tenant is visible.
- **C — Telegram** (staging, when `SMOKE_BOT_CHANNEL_ID` + `SMOKE_BOT_SECRET` set): the webhook rejects a
  missing secret and accepts an authenticated synthetic update (proves ingest security + acceptance).

## Run
    # Local / CI (Tier A + B):
    BASE_URL=http://localhost:8080 OWNER_EMAIL=owner@appido.test OWNER_PASSWORD=... node scripts/smoke.mjs

    # Staging, add Tier C. Get a connected channel id + webhook secret from the DB:
    #   SELECT id, bot_secret FROM channels WHERE bot_token_enc IS NOT NULL LIMIT 1;
    BASE_URL=https://api.appido.io OWNER_EMAIL=... OWNER_PASSWORD=... \
      SMOKE_BOT_CHANNEL_ID=<id> SMOKE_BOT_SECRET=<bot_secret> node scripts/smoke.mjs

Exits non-zero on any failure; absent tiers skip cleanly. CI runs Tier A + B automatically (see
`.github/workflows/ci.yml`): build -> migrate -> create-owner -> boot core-api -> smoke.

## Not covered by the smoke (verify in staging)
- The actual AI reply generation (needs LiteLLM + provider keys + a real/test bot). Confirm by messaging a
  connected bot and watching the reply, or extend Tier C to poll the customer's messages.
- Real-browser cookie behaviour across the three production origins, and load/performance.
