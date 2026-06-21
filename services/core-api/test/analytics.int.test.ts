import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { mrr, gmv, funnel, conversion, overview } from "@appido/analytics";

const HAS_DB = !!process.env.DATABASE_URL && !!process.env.APP_DATABASE_URL;

// Platform aggregates span all tenants, so we assert LOWER BOUNDS that hold regardless of other
// data in the test DB (our seeded tenant must be reflected).
describe.skipIf(!HAS_DB)("owner analytics: MRR / GMV / funnel / conversion aggregates", () => {
  const owner = new Pool({ connectionString: process.env.DATABASE_URL });
  const app = new Pool({ connectionString: process.env.APP_DATABASE_URL });
  let tA = "";
  let cust = "";

  beforeAll(async () => {
    tA = (await owner.query("INSERT INTO tenants (name) VALUES ('AnalyticsA') RETURNING id")).rows[0].id;
    cust = (await owner.query("INSERT INTO customers (tenant_id, name, intent) VALUES ($1,'c',80) RETURNING id", [tA])).rows[0].id;
    // MRR: one active Pro subscription ($179)
    await owner.query("INSERT INTO subscriptions (tenant_id, plan, status, amount_cents, currency, period_start) VALUES ($1,'pro','active',17900,'USD', now())", [tA]);
    // GMV: one successful transaction ($50)
    await owner.query("INSERT INTO transactions (tenant_id, customer_id, amount_cents, currency, gateway, status) VALUES ($1,$2,5000,'USD','manual','ok')", [tA, cust]);
    // Funnel + flywheel: a paid event and a converted AI interaction
    await owner.query("INSERT INTO events (tenant_id, customer_id, type) VALUES ($1,$2,'paid')", [tA, cust]);
    await owner.query("INSERT INTO ai_usage (tenant_id, customer_id, model, task, tier, outcome) VALUES ($1,$2,'x','chat','smart','converted')", [tA, cust]);
  });
  afterAll(async () => {
    if (tA) await owner.query("DELETE FROM tenants WHERE id=$1", [tA]);
    await owner.end();
    await app.end();
  });

  it("MRR counts the active Pro subscription", async () => {
    const m = await mrr(app);
    expect(m.mrrCents).toBeGreaterThanOrEqual(17900);
    expect(m.byPlan.some((p) => p.plan === "pro")).toBe(true);
    expect((m.statuses.active ?? 0)).toBeGreaterThanOrEqual(1);
  });

  it("GMV counts the successful USD transaction", async () => {
    const g = await gmv(app, 30);
    const usd = g.byCurrency.find((c) => c.currency === "USD");
    expect(usd).toBeTruthy();
    expect((usd?.cents ?? 0)).toBeGreaterThanOrEqual(5000);
  });

  it("funnel reflects an engaged, scored, paid customer", async () => {
    const f = await funnel(app);
    expect(f.customers).toBeGreaterThanOrEqual(1);
    expect(f.engaged).toBeGreaterThanOrEqual(1);
    expect(f.scored).toBeGreaterThanOrEqual(1);
    expect(f.paid).toBeGreaterThanOrEqual(1);
  });

  it("conversion reflects the converted chat interaction", async () => {
    const rows = await conversion(app);
    const chat = rows.find((r) => r.task === "chat");
    expect(chat).toBeTruthy();
    expect((chat?.converted ?? 0)).toBeGreaterThanOrEqual(1);
  });

  it("overview composes MRR + GMV + paid customers consistently", async () => {
    const o = await overview(app);
    expect(o.mrrCents).toBeGreaterThanOrEqual(17900);
    expect(o.paidCustomers).toBeGreaterThanOrEqual(1);
    expect(o.gmv30d.some((c) => c.currency === "USD")).toBe(true);
  });
});
