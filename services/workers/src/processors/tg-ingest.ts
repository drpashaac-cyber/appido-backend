import type { Job, Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { Logger } from "pino";
import { eq } from "drizzle-orm";
import { resolveCustomer, runWithRls, schema, type DbHandle } from "@appido/db";
import { redactPII } from "@appido/ai";
import type { TgUpdate, TgMessage } from "@appido/telegram";

export interface TgIngestJob {
  channelId: string;
  tenantId: string;
  update: TgUpdate;
}

/**
 * Ingests one Telegram update into the tenant's CRM. Dedup and all writes happen
 * in ONE transaction, so a mid-processing failure rolls back the dedup too and the
 * job (with retry/backoff) reprocesses cleanly — no lost or double-counted messages.
 * Realtime is published only after a successful, non-skipped commit.
 */
// PII policy cache — only "mask_at_rest" masks the stored message body (operator inbox then sees masked too).
let piiCache: { at: number; atRest: boolean } | null = null;
async function maskAtRest(dbh: DbHandle): Promise<boolean> {
  if (piiCache && Date.now() - piiCache.at < 60_000) return piiCache.atRest;
  const [row] = await runWithRls(dbh.pool, { platform: true }, (tx) =>
    tx.select({ value: schema.appidoSettings.value }).from(schema.appidoSettings).where(eq(schema.appidoSettings.key, "pii_redaction")).limit(1),
  );
  const atRest = (row?.value as unknown) === "mask_at_rest";
  piiCache = { at: Date.now(), atRest };
  return atRest;
}

export function makeTgIngestProcessor(dbh: DbHandle, pub: Redis, aiReplyQueue: Queue, log: Logger) {
  return async (job: Job<TgIngestJob>): Promise<{ ok: boolean; skipped?: boolean }> => {
    const { channelId, tenantId, update } = job.data;

    const msg: TgMessage | undefined = update.message ?? update.edited_message;
    if (!msg || !msg.from || msg.from.is_bot) return { ok: true }; // no side effects → safe to reprocess
    const from = msg.from;
    const text = msg.text ?? msg.caption ?? "";

    let skipped = false;
    let resolvedCustomerId: string | null = null;
    await runWithRls(dbh.pool, { platform: false, tenantId }, async (tx) => {
      // idempotency guard, atomic with the writes below
      const claimed = await tx
        .insert(schema.tgProcessedUpdates)
        .values({ channelId, updateId: update.update_id })
        .onConflictDoNothing()
        .returning({ updateId: schema.tgProcessedUpdates.updateId });
      if (claimed.length === 0) {
        skipped = true;
        return;
      }

      const { customerId, isNew } = await resolveCustomer(tx, {
        tenantId,
        channelId,
        kind: "telegram",
        value: String(from.id),
        name: from.first_name,
        handle: from.username ? `@${from.username}` : null,
        locale: from.language_code ?? null,
      });
      if (isNew) await tx.insert(schema.events).values({ tenantId, customerId, type: "joined" });
      const storedBody = (await maskAtRest(dbh)) ? redactPII(text) : text;
      await tx.insert(schema.messages).values({
        tenantId,
        channelId,
        customerId,
        direction: "in",
        body: storedBody,
        author: "customer",
        tgMessageId: msg.message_id,
      });
      await tx.insert(schema.events).values({ tenantId, customerId, type: "message" });
      resolvedCustomerId = customerId;
    });

    if (skipped) return { ok: true, skipped: true };

    // hand off to the AI agent (the ai-reply worker decides if AI is enabled/managed)
    if (resolvedCustomerId) {
      await aiReplyQueue.add("reply", { channelId, tenantId, customerId: resolvedCustomerId });
    }

    await pub.publish(
      `rt:${tenantId}`,
      JSON.stringify({
        type: "message.created",
        tenantId,
        at: new Date().toISOString(),
        payload: { handle: from.username ? `@${from.username}` : null },
      }),
    );
    log.debug({ tenantId, channelId }, "tg message ingested");
    return { ok: true };
  };
}
