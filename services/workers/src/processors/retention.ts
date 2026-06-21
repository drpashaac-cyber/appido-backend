import type { Job } from "bullmq";
import type { Logger } from "pino";
import { eq, lt } from "drizzle-orm";
import { runWithRls, schema, type DbHandle } from "@appido/db";

// Nightly data-retention purge. When data_retention_days > 0, deletes messages/events older than the
// cutoff across all tenants (platform context). 0 = keep forever (the default). See governance policy.
export function makeRetentionProcessor(dbh: DbHandle, log: Logger) {
  return async (_job: Job): Promise<{ ok: boolean; purged: number; days: number }> => {
    const [row] = await runWithRls(dbh.pool, { platform: true }, (tx) =>
      tx.select({ value: schema.appidoSettings.value }).from(schema.appidoSettings).where(eq(schema.appidoSettings.key, "data_retention_days")).limit(1),
    );
    const days = Number((row?.value as unknown) ?? 0);
    if (!Number.isFinite(days) || days <= 0) return { ok: true, purged: 0, days: 0 }; // 0 = keep forever
    const cutoff = new Date(Date.now() - days * 86_400_000);
    let purged = 0;
    await runWithRls(dbh.pool, { platform: true }, async (tx) => {
      const m = await tx.delete(schema.messages).where(lt(schema.messages.at, cutoff)).returning({ id: schema.messages.id });
      const e = await tx.delete(schema.events).where(lt(schema.events.at, cutoff)).returning({ id: schema.events.id });
      purged = m.length + e.length;
    });
    log.info({ days, purged }, "retention purge done");
    return { ok: true, purged, days };
  };
}
