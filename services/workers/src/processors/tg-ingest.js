"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeTgIngestProcessor = makeTgIngestProcessor;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@appido/db");
const ai_1 = require("@appido/ai");
/**
 * Ingests one Telegram update into the tenant's CRM. Dedup and all writes happen
 * in ONE transaction, so a mid-processing failure rolls back the dedup too and the
 * job (with retry/backoff) reprocesses cleanly — no lost or double-counted messages.
 * Realtime is published only after a successful, non-skipped commit.
 */
// PII policy cache — only "mask_at_rest" masks the stored message body (operator inbox then sees masked too).
let piiCache = null;
async function maskAtRest(dbh) {
    if (piiCache && Date.now() - piiCache.at < 60_000)
        return piiCache.atRest;
    const [row] = await (0, db_1.runWithRls)(dbh.pool, { platform: true }, (tx) => tx.select({ value: db_1.schema.appidoSettings.value }).from(db_1.schema.appidoSettings).where((0, drizzle_orm_1.eq)(db_1.schema.appidoSettings.key, "pii_redaction")).limit(1));
    const atRest = row?.value === "mask_at_rest";
    piiCache = { at: Date.now(), atRest };
    return atRest;
}
function makeTgIngestProcessor(dbh, pub, aiReplyQueue, log) {
    return async (job) => {
        const { channelId, tenantId, update } = job.data;
        const msg = update.message ?? update.edited_message;
        if (!msg || !msg.from || msg.from.is_bot)
            return { ok: true }; // no side effects → safe to reprocess
        const from = msg.from;
        const text = msg.text ?? msg.caption ?? "";
        let skipped = false;
        let resolvedCustomerId = null;
        await (0, db_1.runWithRls)(dbh.pool, { platform: false, tenantId }, async (tx) => {
            // idempotency guard, atomic with the writes below
            const claimed = await tx
                .insert(db_1.schema.tgProcessedUpdates)
                .values({ channelId, updateId: update.update_id })
                .onConflictDoNothing()
                .returning({ updateId: db_1.schema.tgProcessedUpdates.updateId });
            if (claimed.length === 0) {
                skipped = true;
                return;
            }
            const { customerId, isNew } = await (0, db_1.resolveCustomer)(tx, {
                tenantId,
                channelId,
                kind: "telegram",
                value: String(from.id),
                name: from.first_name,
                handle: from.username ? `@${from.username}` : null,
                locale: from.language_code ?? null,
            });
            if (isNew)
                await tx.insert(db_1.schema.events).values({ tenantId, customerId, type: "joined" });
            const storedBody = (await maskAtRest(dbh)) ? (0, ai_1.redactPII)(text) : text;
            await tx.insert(db_1.schema.messages).values({
                tenantId,
                channelId,
                customerId,
                direction: "in",
                body: storedBody,
                author: "customer",
                tgMessageId: msg.message_id,
            });
            await tx.insert(db_1.schema.events).values({ tenantId, customerId, type: "message" });
            resolvedCustomerId = customerId;
        });
        if (skipped)
            return { ok: true, skipped: true };
        // hand off to the AI agent (the ai-reply worker decides if AI is enabled/managed)
        if (resolvedCustomerId) {
            await aiReplyQueue.add("reply", { channelId, tenantId, customerId: resolvedCustomerId });
        }
        await pub.publish(`rt:${tenantId}`, JSON.stringify({
            type: "message.created",
            tenantId,
            at: new Date().toISOString(),
            payload: { handle: from.username ? `@${from.username}` : null },
        }));
        log.debug({ tenantId, channelId }, "tg message ingested");
        return { ok: true };
    };
}
//# sourceMappingURL=tg-ingest.js.map