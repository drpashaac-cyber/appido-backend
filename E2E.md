# APPIDO — end-to-end go-live checklist

Order: **backend → verify → point frontends at the API → end-to-end checks.**

## 1) Backend
- Deploy per `deploy/README.md` (Render recommended). Set all secrets.
- After the first deploy, set `APP_DATABASE_URL` to the `appido_app` role and redeploy (the RLS note).
- Verify: `BASE_URL=https://<your-api> npm run smoke` — expects health ok, readiness db+redis ok, and
  401 on a protected route.
- First owner: `seed` makes `OWNER_EMAIL` the primary owner. Log in from the owner console with the
  email code (arrives via Resend once `RESEND_API_KEY` is set; otherwise it's printed in the API logs).

## 2) Point the frontends at the API
Every frontend reads `window.APPIDO_API_BASE`. Set it to your deployed API origin (no trailing slash).
- **Owner console**: edit `public/config.js` →
  ```js
  window.APPIDO_API_BASE = "https://api.appido.io";
  ```
  then rebuild/redeploy (or have your host/CI write that file).
- **Tenant dashboard + landing**: drop the same `public/config.js` in and add
  `<script src="/config.js"></script>` to their `index.html` (before the app bundle).

## 3) End-to-end (the live path today)
1. Owner console → log in (owner email).
2. Open **Analytics** → confirm the header shows **"live"** (not "demo data") and that
   MRR / GMV / funnel / cohort / conversion load from the backend. Values are zero/low until real data
   exists — that is correct, not a bug.
3. Generate data: create a tenant + a product, run a **sandbox** payment through a configured gateway,
   confirm a `paid` event, then reload Analytics → GMV / funnel reflect it.

## Data status (precise)
| Surface | Status |
|---|---|
| Backend API (auth, CRM, products, payments ×9, billing, AI, analytics, realtime, ops) | live |
| Owner console — **Analytics** (MRR/GMV/funnel/cohort/conversion) | **live-wired** to `/v1/owner/analytics/*` |
| Owner console — other views (tenants/customers/revenue/AI ops/…) | demo data |
| Tenant dashboard | demo data |
| Landing | static marketing (no API needed) |

## Next milestone — full frontend data-wiring
Replace each frontend's `MockApi` with an HTTP client behind the existing `Api` seam, view by view.
The owner console's **Analytics** view (`loadAnalytics` → `/v1/owner/analytics/*` with a demo fallback)
is the reference implementation: add the remaining owner endpoints, then the tenant dashboard's
`/v1/*` + auth/session, the same way. This is a scoped build, not a config change — do it incrementally
so each surface flips from demo to live independently.
