import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { runWithRls, schema } from "@appido/db";
import { activateSubscription, generateActivationCodes, redeemActivationCode } from "@appido/payments";

const HAS_DB = !!process.env.DATABASE_URL && !!process.env.APP_DATABASE_URL;

describe.skipIf(!HAS_DB)("billing: subscription activation + activation codes + outbox", () => {
  const owner = new Pool({ connectionString: process.env.DATABASE_URL });
  const app = new Pool({ connectionString: process.env.APP_DATABASE_URL });
  let tA = "";

  beforeAll(async () => {
    tA = (await owner.query("INSERT INTO tenants (name) VALUES ('BillA') RETURNING id")).rows[0].id;
  });
  afterAll(async () => {
    if (tA) await owner.query("DELETE FROM tenants WHERE id=$1", [tA]);
    await owner.end();
    await app.end();
  });

  it("activateSubscription creates an active sub + subscription.updated outbox", async () => {
    const { id } = await activateSubscription(app, { tenantId: tA, plan: "pro" });
    expect(id).toBeTruthy();
    const [sub] = await runWithRls(app, { platform: false, tenantId: tA }, (q) =>
      q.select({ status: schema.subscriptions.status, plan: schema.subscriptions.plan }).from(schema.subscriptions).where(eq(schema.subscriptions.id, id)),
    );
    expect(sub.status).toBe("active");
    expect(sub.plan).toBe("pro");
    const ob = await runWithRls(app, { platform: false, tenantId: tA }, (q) =>
      q.select().from(schema.outbox).where(eq(schema.outbox.type, "subscription.updated")),
    );
    expect(ob.length).toBeGreaterThanOrEqual(1);
  });

  it("an activation code redeems exactly once (race-safe)", async () => {
    const { codes } = await generateActivationCodes(app, { plan: "start", count: 1 });
    const code = codes[0];
    const first = await redeemActivationCode(app, { tenantId: tA, code });
    expect(first.ok).toBe(true);
    expect(first.plan).toBe("start");
    const second = await redeemActivationCode(app, { tenantId: tA, code });
    expect(second.ok).toBe(false);
    expect(second.error).toBe("invalid_or_used");
  });
});
