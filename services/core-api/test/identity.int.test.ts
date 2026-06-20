import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { resolveCustomer, runWithRls } from "@appido/db";

const HAS_DB = !!process.env.DATABASE_URL && !!process.env.APP_DATABASE_URL;

describe.skipIf(!HAS_DB)("resolveCustomer (customer-360 identity graph)", () => {
  const owner = new Pool({ connectionString: process.env.DATABASE_URL });
  const app = new Pool({ connectionString: process.env.APP_DATABASE_URL });
  let tenantId = "";

  beforeAll(async () => {
    const t = await owner.query("INSERT INTO tenants (name) VALUES ('IdTest') RETURNING id");
    tenantId = t.rows[0].id;
  });
  afterAll(async () => {
    if (tenantId) await owner.query("DELETE FROM tenants WHERE id=$1", [tenantId]);
    await owner.end();
    await app.end();
  });

  it("creates on first contact and resolves the same customer on repeat", async () => {
    const first = await runWithRls(app, { platform: false, tenantId }, (tx) =>
      resolveCustomer(tx, { tenantId, kind: "telegram", value: "999001", name: "Test", handle: "@t" }),
    );
    expect(first.isNew).toBe(true);

    const again = await runWithRls(app, { platform: false, tenantId }, (tx) =>
      resolveCustomer(tx, { tenantId, kind: "telegram", value: "999001" }),
    );
    expect(again.isNew).toBe(false);
    expect(again.customerId).toBe(first.customerId);
  });

  it("different identities resolve to different customers", async () => {
    const tg = await runWithRls(app, { platform: false, tenantId }, (tx) =>
      resolveCustomer(tx, { tenantId, kind: "telegram", value: "999002" }),
    );
    const email = await runWithRls(app, { platform: false, tenantId }, (tx) =>
      resolveCustomer(tx, { tenantId, kind: "email", value: "a@b.com" }),
    );
    expect(email.customerId).not.toBe(tg.customerId);
  });
});
