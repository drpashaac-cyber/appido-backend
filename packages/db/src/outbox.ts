import { asc, eq, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import * as schema from "./schema";
import { runWithRls } from "./rls";

export interface OutboxEvent {
  tenantId: string;
  type: string;
  payload?: Record<string, unknown>;
}

/** Write an event in the SAME transaction as the state change (transactional outbox). */
export function emitEvent(tx: NodePgDatabase<typeof schema>, evt: OutboxEvent): Promise<unknown> {
  return tx.insert(schema.outbox).values({ tenantId: evt.tenantId, type: evt.type, payload: evt.payload ?? null });
}

/** Relay: publish unpublished outbox rows at-least-once, then mark them published. */
export async function relayOutbox(
  pool: Pool,
  publish: (channel: string, message: string) => Promise<unknown> | unknown,
  limit = 200,
): Promise<number> {
  const rows = await runWithRls(pool, { platform: true }, (tx) =>
    tx
      .select({ id: schema.outbox.id, tenantId: schema.outbox.tenantId, type: schema.outbox.type, payload: schema.outbox.payload, createdAt: schema.outbox.createdAt })
      .from(schema.outbox)
      .where(isNull(schema.outbox.publishedAt))
      .orderBy(asc(schema.outbox.createdAt))
      .limit(limit),
  );
  for (const r of rows) {
    await publish(`rt:${r.tenantId}`, JSON.stringify({ type: r.type, tenantId: r.tenantId, at: r.createdAt, payload: r.payload }));
    await runWithRls(pool, { platform: true }, (tx) => tx.update(schema.outbox).set({ publishedAt: new Date() }).where(eq(schema.outbox.id, r.id)));
  }
  return rows.length;
}
