import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { runWithRls, schema } from "@appido/db";

const HAS_DB = !!process.env.DATABASE_URL && !!process.env.APP_DATABASE_URL;

describe.skipIf(!HAS_DB)("RLS tenant isolation", () => {
  const owner = new Pool({ connectionString: process.env.DATABASE_URL });
  const app = new Pool({ connectionString: process.env.APP_DATABASE_URL });
  let tA = "";
  let tB = "";

  beforeAll(async () => {
    const a = await owner.query("INSERT INTO tenants (name) VALUES ('A') RETURNING id");
    const b = await owner.query("INSERT INTO tenants (name) VALUES ('B') RETURNING id");
    tA = a.rows[0].id;
    tB = b.rows[0].id;
    await owner.query("INSERT INTO channels (tenant_id, name) VALUES ($1,'chA'),($2,'chB')", [tA, tB]);
    await owner.query("INSERT INTO customers (tenant_id, name) VALUES ($1,'custA'),($2,'custB')", [tA, tB]);
  });

  afterAll(async () => {
    if (tA && tB) await owner.query("DELETE FROM tenants WHERE id = ANY($1)", [[tA, tB]]);
    await owner.end();
    await app.end();
  });

  it("channels are isolated per tenant", async () => {
    const rows = await runWithRls(app, { platform: false, tenantId: tA }, (tx) => tx.select().from(schema.channels));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.tenantId === tA)).toBe(true);
  });

  it("customers are isolated per tenant", async () => {
    const rows = await runWithRls(app, { platform: false, tenantId: tB }, (tx) => tx.select().from(schema.customers));
    expect(rows.some((r) => r.tenantId === tA)).toBe(false);
    expect(rows.every((r) => r.tenantId === tB)).toBe(true);
  });

  it("platform context sees every tenant", async () => {
    const rows = await runWithRls(app, { platform: true }, (tx) => tx.select().from(schema.customers));
    const ids = new Set(rows.map((r) => r.tenantId));
    expect(ids.has(tA) && ids.has(tB)).toBe(true);
  });
});
