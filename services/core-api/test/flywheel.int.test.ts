import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { runWithRls, schema } from "@appido/db";
import { attributeOutcomes, flywheelStats } from "@appido/ai";

const HAS_DB = !!process.env.DATABASE_URL && !!process.env.APP_DATABASE_URL;
const DAY = 24 * 3600 * 1000;

describe.skipIf(!HAS_DB)("flywheel: outcome attribution closes the loop", () => {
  const owner = new Pool({ connectionString: process.env.DATABASE_URL });
  const app = new Pool({ connectionString: process.env.APP_DATABASE_URL });
  let tA = "";
  let cust = "";
  let camp = "";
  let recentUsage = "";
  let oldUsage = "";
  let sendId = "";

  beforeAll(async () => {
    tA = (await owner.query("INSERT INTO tenants (name) VALUES ('FlyA') RETURNING id")).rows[0].id;
    cust = (await owner.query("INSERT INTO customers (tenant_id, name) VALUES ($1,'c') RETURNING id", [tA])).rows[0].id;

    const ins = await runWithRls(app, { platform: false, tenantId: tA }, async (q) => {
      const [r1] = await q
        .insert(schema.aiUsage)
        .values({ tenantId: tA, customerId: cust, model: "x", task: "chat", tier: "smart", at: new Date() })
        .returning({ id: schema.aiUsage.id });
      const [r2] = await q
        .insert(schema.aiUsage)
        .values({ tenantId: tA, customerId: cust, model: "x", task: "chat", tier: "smart", at: new Date(Date.now() - 20 * DAY) })
        .returning({ id: schema.aiUsage.id });
      const [c] = await q.insert(schema.campaigns).values({ tenantId: tA, name: "C", goal: "g", body: "b" }).returning({ id: schema.campaigns.id });
      return { r1: r1.id, r2: r2.id, c: c.id };
    });
    recentUsage = ins.r1;
    oldUsage = ins.r2;
    camp = ins.c;
    const send = await runWithRls(app, { platform: false, tenantId: tA }, (q) =>
      q.insert(schema.campaignSends).values({ tenantId: tA, campaignId: camp, customerId: cust, status: "sent", at: new Date() }).returning({ id: schema.campaignSends.id }),
    );
    sendId = send[0].id;
    await runWithRls(app, { platform: false, tenantId: tA }, (q) =>
      q.insert(schema.events).values({ tenantId: tA, customerId: cust, type: "paid" }),
    );
  });
  afterAll(async () => {
    if (tA) await owner.query("DELETE FROM tenants WHERE id=$1", [tA]);
    await owner.end();
    await app.end();
  });

  it("attributes paid → converted, ages out non-conversions, marks converting sends", async () => {
    await attributeOutcomes(app, { lookbackDays: 3, windowDays: 14 });

    const [recent] = await runWithRls(app, { platform: false, tenantId: tA }, (q) =>
      q.select({ outcome: schema.aiUsage.outcome }).from(schema.aiUsage).where(eq(schema.aiUsage.id, recentUsage)),
    );
    expect(recent.outcome).toBe("converted");

    const [old] = await runWithRls(app, { platform: false, tenantId: tA }, (q) =>
      q.select({ outcome: schema.aiUsage.outcome }).from(schema.aiUsage).where(eq(schema.aiUsage.id, oldUsage)),
    );
    expect(old.outcome).toBe("no_conversion");

    const [send] = await runWithRls(app, { platform: false, tenantId: tA }, (q) =>
      q.select({ convertedAt: schema.campaignSends.convertedAt }).from(schema.campaignSends).where(eq(schema.campaignSends.id, sendId)),
    );
    expect(send.convertedAt).not.toBeNull();
  });

  it("flywheelStats reports the chat conversion", async () => {
    const stats = await flywheelStats(app, tA);
    const chat = stats.find((s) => s.task === "chat");
    expect(chat).toBeTruthy();
    expect(chat?.converted ?? 0).toBeGreaterThanOrEqual(1);
  });
});
