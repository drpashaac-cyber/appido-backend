import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { emitEvent, relayOutbox, runWithRls, schema } from "@appido/db";

const HAS_DB = !!process.env.DATABASE_URL && !!process.env.APP_DATABASE_URL;

describe.skipIf(!HAS_DB)("outbox → relay (at-least-once, idempotent)", () => {
  const owner = new Pool({ connectionString: process.env.DATABASE_URL });
  const app = new Pool({ connectionString: process.env.APP_DATABASE_URL });
  let tA = "";

  beforeAll(async () => {
    tA = (await owner.query("INSERT INTO tenants (name) VALUES ('OutboxA') RETURNING id")).rows[0].id;
  });
  afterAll(async () => {
    if (tA) await owner.query("DELETE FROM tenants WHERE id=$1", [tA]);
    await owner.end();
    await app.end();
  });

  it("emitEvent writes a row the relay publishes once and marks published", async () => {
    await runWithRls(app, { platform: false, tenantId: tA }, (tx) => emitEvent(tx, { tenantId: tA, type: "test.event", payload: { n: 1 } }));

    const published: { channel: string; message: string }[] = [];
    const collect = (channel: string, message: string): Promise<void> => {
      published.push({ channel, message });
      return Promise.resolve();
    };
    await relayOutbox(app, collect);

    const mine = published.find((p) => p.channel === `rt:${tA}`);
    expect(mine).toBeTruthy();
    expect(JSON.parse(mine!.message).type).toBe("test.event");

    const rows = await runWithRls(app, { platform: false, tenantId: tA }, (q) =>
      q.select({ publishedAt: schema.outbox.publishedAt }).from(schema.outbox).where(eq(schema.outbox.type, "test.event")),
    );
    expect(rows.every((r) => r.publishedAt !== null)).toBe(true);

    // second relay must not re-publish our (now-published) event
    await relayOutbox(app, collect);
    const minePublishes = published.filter((p) => p.channel === `rt:${tA}`).length;
    expect(minePublishes).toBe(1);
  });
});
