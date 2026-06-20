#!/usr/bin/env node
// APPIDO end-to-end smoke. Exercises the REAL launch-critical HTTP path against a RUNNING backend.
// It manages cookies + CSRF exactly like the browsers do, so it proves auth/session/RLS for real.
//
// Usage:
//   BASE_URL=http://localhost:8080 node scripts/smoke.mjs
// Tier B (owner console path) runs when these are set (same values you pass to `create-owner`):
//   OWNER_EMAIL=... OWNER_PASSWORD=...
// Tier C (Telegram webhook ingest) runs when a connected channel is provided (staging):
//   SMOKE_BOT_CHANNEL_ID=... SMOKE_BOT_SECRET=...
//
// Exits non-zero on any failure. Absent tiers skip cleanly (never fail).

const base = (process.env.BASE_URL || process.env.PUBLIC_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
let failed = 0;
let passed = 0;
let skipped = 0;
const ok = (n) => {
  passed++;
  console.log(`  ok    ${n}`);
};
const bad = (n, e) => {
  failed++;
  console.log(`  FAIL  ${n}${e ? " — " + e : ""}`);
};
const skip = (n, why) => {
  skipped++;
  console.log(`  skip  ${n}${why ? " — " + why : ""}`);
};

// Minimal cookie jar + CSRF-aware client (one per actor: anonymous / tenant / owner).
function makeClient() {
  const jar = new Map();
  const absorb = (res) => {
    const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    for (const c of list) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  };
  const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  async function call(method, path, body) {
    const headers = { "content-type": "application/json" };
    const ck = cookieHeader();
    if (ck) headers.cookie = ck;
    const csrf = jar.get("appido_csrf");
    if (csrf && method !== "GET") headers["x-csrf-token"] = csrf;
    let res;
    try {
      res = await fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch (e) {
      return { res: null, json: null, status: 0, error: String(e) };
    }
    absorb(res);
    let json = null;
    try {
      json = await res.clone().json();
    } catch {
      /* non-JSON body */
    }
    return { res, json, status: res.status };
  }
  return { call, jar };
}

async function main() {
  console.log(`APPIDO smoke -> ${base}`);

  // ---------------- Tier A: core HTTP path ----------------
  console.log("\n[A] core — health, auth guard, public reads, tenant self-serve");
  const anon = makeClient();

  {
    const { res, json, error } = await anon.call("GET", "/health");
    res && res.ok && json?.status === "ok" ? ok("GET /health (liveness)") : bad("GET /health", error || `status ${res?.status}`);
  }
  {
    const { res, json } = await anon.call("GET", "/health/ready");
    res && res.ok && json?.db && json?.redis ? ok("GET /health/ready (db + redis reachable)") : bad("GET /health/ready", JSON.stringify(json));
  }
  {
    const { status } = await anon.call("GET", "/v1/owner/overview");
    status === 401 ? ok("protected route -> 401 unauthenticated") : bad("protected route auth", `expected 401, got ${status}`);
  }
  // Landing + dashboard depend on these public reads.
  {
    const { res, json } = await anon.call("GET", "/v1/plans");
    res && res.ok && Array.isArray(json) ? ok(`GET /v1/plans (${json.length} plans)`) : bad("GET /v1/plans", `status ${res?.status}`);
  }
  {
    const { res, json } = await anon.call("GET", "/v1/settings");
    res && res.ok && typeof json?.trialDays === "number" ? ok(`GET /v1/settings (trial ${json.trialDays}d)`) : bad("GET /v1/settings", JSON.stringify(json));
  }

  // tenant self-serve: register issues a session via the same cookie path as login
  const tenant = makeClient();
  await tenant.call("GET", "/auth/csrf");
  const email = `smoke+${Date.now()}@appido.test`;
  {
    const { res, json } = await tenant.call("POST", "/auth/register", { email, password: "Smoke-Pass-123!", name: "Smoke", brand: "Smoke Co" });
    res && res.ok && json?.ok ? ok("POST /auth/register (tenant + session)") : bad("POST /auth/register", `status ${res?.status} ${JSON.stringify(json)}`);
  }
  {
    const { res, json } = await tenant.call("GET", "/me");
    res && res.ok && json?.tenantId ? ok(`GET /me (role ${json.role})`) : bad("GET /me", `status ${res?.status}`);
  }
  // every dashboard data read must answer for an authenticated tenant (RLS-scoped)
  for (const p of ["/v1/products", "/v1/customers", "/v1/dashboard/summary", "/v1/usage", "/v1/inbox", "/v1/payments/methods", "/v1/governance", "/v1/ai/script"]) {
    const { res } = await tenant.call("GET", p);
    res && res.ok ? ok(`GET ${p}`) : bad(`GET ${p}`, `status ${res?.status}`);
  }

  // ---------------- Tier B: owner console data path ----------------
  console.log("\n[B] owner — login + the five console data endpoints");
  const ownerEmail = process.env.OWNER_EMAIL;
  const ownerPass = process.env.OWNER_PASSWORD;
  if (!ownerEmail || !ownerPass) {
    skip("owner path", "set OWNER_EMAIL + OWNER_PASSWORD (same as create-owner)");
  } else {
    const owner = makeClient();
    await owner.call("GET", "/auth/csrf");
    const { res: lr, json: lj } = await owner.call("POST", "/auth/login/password", { email: ownerEmail, password: ownerPass });
    if (!(lr && lr.ok && lj?.ok)) {
      bad("owner login", `status ${lr?.status} ${JSON.stringify(lj)}`);
    } else {
      ok("POST /auth/login/password (owner session)");
      for (const p of ["/v1/owner/overview", "/v1/owner/tenants", "/v1/owner/analytics/mrr", "/v1/owner/analytics/gmv", "/v1/owner/analytics/funnel", "/v1/owner/leads"]) {
        const { res } = await owner.call("GET", p);
        res && res.ok ? ok(`GET ${p}`) : bad(`GET ${p}`, `status ${res?.status}`);
      }
      const { json: ov } = await owner.call("GET", "/v1/owner/overview");
      ov && Number(ov.tenants) >= 1 ? ok(`owner overview reflects ${ov.tenants} tenant(s)`) : bad("owner overview tenants", JSON.stringify(ov));
    }
  }

  // ---------------- Tier C: Telegram webhook ingest (staging) ----------------
  console.log("\n[C] Telegram — webhook secret guard + authenticated ingest");
  const chId = process.env.SMOKE_BOT_CHANNEL_ID;
  const secret = process.env.SMOKE_BOT_SECRET;
  if (!chId || !secret) {
    skip("Telegram webhook", "set SMOKE_BOT_CHANNEL_ID + SMOKE_BOT_SECRET (a connected channel)");
  } else {
    try {
      const r1 = await fetch(`${base}/tg/${chId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ update_id: 1 }) });
      r1.status === 401 || r1.status === 403 ? ok("webhook rejects a missing/invalid secret") : bad("webhook secret guard", `expected 401/403, got ${r1.status}`);
    } catch (e) {
      bad("webhook secret guard", String(e));
    }
    try {
      const update = {
        update_id: Date.now(),
        message: { message_id: 1, date: Math.floor(Date.now() / 1000), text: "smoke ping", chat: { id: 999_999, type: "private" }, from: { id: 999_999, is_bot: false, first_name: "Smoke" } },
      };
      const r2 = await fetch(`${base}/tg/${chId}`, { method: "POST", headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secret }, body: JSON.stringify(update) });
      r2.ok ? ok("webhook accepts an authenticated update (queued for ingest)") : bad("webhook accept", `status ${r2.status}`);
    } catch (e) {
      bad("webhook accept", String(e));
    }
  }

  console.log(`\n${failed ? "SMOKE FAILED" : "SMOKE PASSED \u2713"}  (pass ${passed}, fail ${failed}, skip ${skipped})`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("smoke crashed:", e);
  process.exit(1);
});
