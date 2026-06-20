import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { runWithRls, schema } from "@appido/db";

const HAS_DB = !!process.env.DATABASE_URL && !!process.env.APP_DATABASE_URL;

describe.skipIf(!HAS_DB)("growth: segments / campaigns / sends are tenant-isolated", () => {
  const owner = new Pool({ connectionString: process.env.DATABASE_URL });
  const app = new Pool({ connectionString: process.env.APP_DATABASE_URL });
  let tA = "";
  let tB = "";
  let custA = "";
  let campA = "";

  beforeAll(async () => {
    tA = (await owner.query("INSERT INTO tenants (name) VALUES ('GrowA') RETURNING id")).rows[0].id;
    tB = (await owner.query("INSERT INTO tenants (name) VALUES ('GrowB') RETURNING id")).rows[0].id;
    custA = (await owner.query("INSERT INTO customers (tenant_id, name) VALUES ($1,'c') RETURNING id", [tA])).rows[0].id;
  });
  afterAll(async () => {
    if (tA && tB) await owner.query("DELETE FROM tenants WHERE id = ANY($1)", [[tA, tB]]);
    await owner.end();
    await app.end();
  });

  it("creates a segment + campaign + send under tenant A", async () => {
    await runWithRls(app, { platform: false, tenantId: tA }, (q) =>
      q.insert(schema.segments).values({ tenantId: tA, name: "S", criteria: { minScore: 50 } }),
    );
    const [c] = await runWithRls(app, { platform: false, tenantId: tA }, (q) =>
      q.insert(schema.campaigns).values({ tenantId: tA, name: "C", goal: "promo", body: "hi" }).returning({ id: schema.campaigns.id }),
    );
    campA = c.id;
    await runWithRls(app, { platform: false, tenantId: tA }, (q) =>
      q.insert(schema.campaignSends).values({ tenantId: tA, campaignId: campA, customerId: custA, status: "sent" }),
    );
    expect(campA).toBeTruthy();
  });

  it("tenant B sees none of tenant A's growth rows", async () => {
    const segs = await runWithRls(app, { platform: false, tenantId: tB }, (q) => q.select().from(schema.segments));
    const camps = await runWithRls(app, { platform: false, tenantId: tB }, (q) => q.select().from(schema.campaigns));
    const sends = await runWithRls(app, { platform: false, tenantId: tB }, (q) => q.select().from(schema.campaignSends));
    expect(segs.some((r) => r.tenantId === tA)).toBe(false);
    expect(camps.some((r) => r.id === campA)).toBe(false);
    expect(sends.some((r) => r.tenantId === tA)).toBe(false);
  });

  it("tenant A sees its own campaign", async () => {
    const camps = await runWithRls(app, { platform: false, tenantId: tA }, (q) => q.select().from(schema.campaigns));
    expect(camps.some((r) => r.id === campA)).toBe(true);
  });
});
