import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { and, eq } from "drizzle-orm";
import { runWithRls, schema } from "@appido/db";
import { finalizeTransaction } from "@appido/payments";
import { SecretCipher } from "@appido/crypto";

const HAS_DB = !!process.env.DATABASE_URL && !!process.env.APP_DATABASE_URL;

describe.skipIf(!HAS_DB)("payments: finalize → GMV + transactional outbox", () => {
  const owner = new Pool({ connectionString: process.env.DATABASE_URL });
  const app = new Pool({ connectionString: process.env.APP_DATABASE_URL });
  const cipher = new SecretCipher("test-master-key-test-master-key-xx");
  let tA = "";
  let tB = "";
  let chA = "";
  let custA = "";
  let prodA = "";
  let txId = "";

  beforeAll(async () => {
    tA = (await owner.query("INSERT INTO tenants (name) VALUES ('PayA') RETURNING id")).rows[0].id;
    tB = (await owner.query("INSERT INTO tenants (name) VALUES ('PayB') RETURNING id")).rows[0].id;
    chA = (await owner.query("INSERT INTO channels (tenant_id, name) VALUES ($1,'ch') RETURNING id", [tA])).rows[0].id;
    custA = (await owner.query("INSERT INTO customers (tenant_id, name) VALUES ($1,'c') RETURNING id", [tA])).rows[0].id;
    prodA = (await owner.query("INSERT INTO products (tenant_id, name, price_cents, duration_days) VALUES ($1,'P',1000,30) RETURNING id", [tA])).rows[0].id;
    txId = (
      await owner.query(
        "INSERT INTO transactions (tenant_id, channel_id, customer_id, product_id, amount_cents, currency, gateway, status) VALUES ($1,$2,$3,$4,1000,'USD','manual','pending') RETURNING id",
        [tA, chA, custA, prodA],
      )
    ).rows[0].id;
  });
  afterAll(async () => {
    if (tA && tB) await owner.query("DELETE FROM tenants WHERE id = ANY($1)", [[tA, tB]]);
    await owner.end();
    await app.end();
  });

  it("confirms a pending transaction and emits payment.confirmed in the same tx", async () => {
    const r = await finalizeTransaction(app, cipher, { tenantId: tA, transactionId: txId });
    expect(r.ok).toBe(true);

    const [tx] = await runWithRls(app, { platform: false, tenantId: tA }, (q) =>
      q.select({ status: schema.transactions.status }).from(schema.transactions).where(eq(schema.transactions.id, txId)),
    );
    expect(tx.status).toBe("ok");

    const paid = await runWithRls(app, { platform: false, tenantId: tA }, (q) =>
      q.select().from(schema.events).where(and(eq(schema.events.customerId, custA), eq(schema.events.type, "paid"))),
    );
    expect(paid.length).toBe(1);

    const ob = await runWithRls(app, { platform: false, tenantId: tA }, (q) =>
      q.select().from(schema.outbox).where(eq(schema.outbox.type, "payment.confirmed")),
    );
    expect(ob.length).toBe(1);
  });

  it("is idempotent — re-finalize duplicates nothing", async () => {
    const r = await finalizeTransaction(app, cipher, { tenantId: tA, transactionId: txId });
    expect(r.alreadyDone).toBe(true);
    const paid = await runWithRls(app, { platform: false, tenantId: tA }, (q) =>
      q.select().from(schema.events).where(eq(schema.events.type, "paid")),
    );
    expect(paid.length).toBe(1);
    const ob = await runWithRls(app, { platform: false, tenantId: tA }, (q) =>
      q.select().from(schema.outbox).where(eq(schema.outbox.type, "payment.confirmed")),
    );
    expect(ob.length).toBe(1);
  });

  it("transactions are tenant-isolated", async () => {
    const rows = await runWithRls(app, { platform: false, tenantId: tB }, (q) => q.select().from(schema.transactions));
    expect(rows.some((r) => r.id === txId)).toBe(false);
  });
});
