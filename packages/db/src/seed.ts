// Seeds the bootstrap owner (BACKEND.md §3) + a demo tenant so both consoles
// render real, live data. Idempotent (fixed UUIDs + presence guards).
import { Pool } from "pg";
import { loadConfig } from "@appido/config";

const TENANT = "11111111-1111-1111-1111-111111111111";
const CHANNEL = "22222222-2222-2222-2222-222222222222";
const P1 = "33333333-3333-3333-3333-333333330001";
const P2 = "33333333-3333-3333-3333-333333330002";
const P3 = "33333333-3333-3333-3333-333333330003";

async function run(): Promise<void> {
  const { DATABASE_URL, OWNER_EMAIL } = loadConfig();
  const pool = new Pool({ connectionString: DATABASE_URL });

  // 1) platform owner (passwordless email-code)
  await pool.query(
    `INSERT INTO users (email, name, role, status, method)
     VALUES ($1,'Owner','owner','active','code') ON CONFLICT (email) DO NOTHING`,
    [OWNER_EMAIL],
  );

  // 2) demo tenant + channel + a tenant admin login
  await pool.query(`INSERT INTO tenants (id, name, country, timezone, locale, currency)
     VALUES ($1,'Acme Coaching','AE','Asia/Dubai','en','USD') ON CONFLICT (id) DO NOTHING`,
    [TENANT]);
  await pool.query(
    `INSERT INTO channels (id, tenant_id, name, username, members, ai_model, ai_tone, ai_goal, ai_languages)
     VALUES ($1,$2,'Acme VIP','@acme_vip',4200,'claude','friendly','convert', ARRAY['en','fa'])
     ON CONFLICT (id) DO NOTHING`,
    [CHANNEL, TENANT],
  );
  await pool.query(
    `INSERT INTO users (email, name, role, status, method, tenant_id)
     VALUES ('manager@acme.test','Acme Manager','tenant_admin','active','code',$1)
     ON CONFLICT (email) DO NOTHING`,
    [TENANT],
  );

  // 3) products (the tenant's OWN catalog — own price/duration)
  await pool.query(
    `INSERT INTO products (id, tenant_id, name, price_cents, currency, duration_days, description, active) VALUES
       ($1,$4,'Starter Course',1000,'USD',30,'Intro coaching package',true),
       ($2,$4,'VIP Membership',2200,'USD',30,'Monthly VIP access',true),
       ($3,$4,'Agency Plan',9000,'USD',30,'Team plan',true)
     ON CONFLICT (id) DO NOTHING`,
    [P1, P2, P3, TENANT],
  );

  // 4) APPIDO subscription = MRR (Pro $179) — separate from tenant sales
  await pool.query(
    `INSERT INTO subscriptions (tenant_id, plan, status, period_end, amount_cents, currency, gateway, activation_code)
     SELECT $1,'pro','active', now() + interval '30 days', 17900,'USD','zarinpal','APD-DEMO-0001'
     WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE tenant_id=$1)`,
    [TENANT],
  );

  // 5) customers + timeline + sales (GMV) + token usage — only if empty
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM customers WHERE tenant_id=$1`, [TENANT]);
  if (rows[0].n === 0) {
    const people: [string, string, string, string, number, number, number, boolean][] = [
      // name, handle, tag, segment, intent, ltvCents, points, isVip
      ["Sara K.", "@sara_k", "vip", "vip", 92, 17000, 320, true],
      ["Elif A.", "@elifa", "vip", "vip", 80, 12000, 260, true],
      ["Dmitry V.", "@dmitryv", "warm", "ai", 71, 1000, 95, false],
      ["Niloofar R.", "@niloo_r", "warm", "needs", 68, 2200, 120, false],
      ["Omar H.", "@omar_h", "cold", "ai", 44, 0, 10, false],
      ["Ivan P.", "@ivanp", "warm", "ai", 63, 1000, 60, false],
    ];
    for (const [name, handle, tag, segment, intent, ltv, points, vip] of people) {
      const c = await pool.query(
        `INSERT INTO customers (tenant_id, channel_id, name, handle, tag, segment, intent, ltv_cents, points, is_vip, ai_managed)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [TENANT, CHANNEL, name, handle, tag, segment, intent, ltv, points, vip, segment === "ai"],
      );
      const cid = c.rows[0].id;
      await pool.query(`INSERT INTO events (tenant_id, customer_id, type) VALUES ($1,$2,'joined')`, [TENANT, cid]);
      if (ltv > 0) {
        await pool.query(
          `INSERT INTO events (tenant_id, customer_id, type, amount_cents, currency) VALUES ($1,$2,'paid',$3,'USD')`,
          [TENANT, cid, ltv],
        );
        await pool.query(
          `INSERT INTO transactions (tenant_id, channel_id, customer_id, product_id, amount_cents, currency, gateway, status, provider_ref)
           VALUES ($1,$2,$3,$4,$5,'USD','zarinpal','ok',$6)`,
          [TENANT, CHANNEL, cid, vip ? P2 : P1, ltv, "seed-" + cid.slice(0, 8)],
        );
      }
      if (vip) await pool.query(`INSERT INTO events (tenant_id, customer_id, type) VALUES ($1,$2,'vip')`, [TENANT, cid]);
    }
    // a little AI token usage
    await pool.query(
      `INSERT INTO ai_usage (tenant_id, model, tokens_in, tokens_out, cost_micro_usd)
       VALUES ($1,'claude',1820,640,18200),($1,'claude',940,310,9100),($1,'gpt',1200,420,7800)`,
      [TENANT],
    );
  }

  // eslint-disable-next-line no-console
  console.log("seed complete: owner + demo tenant (Acme Coaching)");
  await pool.end();
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
