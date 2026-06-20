import { and, eq } from "drizzle-orm";
import type { Pool } from "pg";
import { emitEvent, runWithRls, schema } from "@appido/db";
import type { SecretCipher } from "@appido/crypto";
import { TelegramApi } from "@appido/telegram";

/** Confirm a pending transaction: mark ok (idempotent), record the sale, and grant the
 *  customer access to the tenant's Telegram group. Used by the gateway callback, the
 *  on-chain watcher, and manual confirmation. */
export async function finalizeTransaction(
  pool: Pool,
  cipher: SecretCipher,
  input: {
    tenantId: string;
    transactionId: string;
    providerRef?: string;
  },
): Promise<{ ok: boolean; alreadyDone?: boolean; granted?: boolean }> {
  const claimed = await runWithRls(pool, { platform: false, tenantId: input.tenantId }, async (tx) => {
    const rows = await tx
      .update(schema.transactions)
      .set({ status: "ok", ...(input.providerRef ? { providerRef: input.providerRef } : {}) })
      .where(and(eq(schema.transactions.id, input.transactionId), eq(schema.transactions.status, "pending")))
      .returning({
        id: schema.transactions.id,
        customerId: schema.transactions.customerId,
        channelId: schema.transactions.channelId,
        productId: schema.transactions.productId,
      });
    // transactional outbox: durable payment.confirmed in the same tx as the status flip
    if (rows.length) await emitEvent(tx, { tenantId: input.tenantId, type: "payment.confirmed", payload: { transactionId: rows[0].id } });
    return rows;
  });
  if (claimed.length === 0) return { ok: true, alreadyDone: true }; // not pending → already handled
  const t = claimed[0];

  if (t.customerId) {
    await runWithRls(pool, { platform: false, tenantId: input.tenantId }, (tx) =>
      tx.insert(schema.events).values({ tenantId: input.tenantId, customerId: t.customerId!, type: "paid", meta: { transactionId: t.id } }),
    );
  }

  let granted = false;
  if (t.channelId && t.customerId) {
    const channel = await runWithRls(pool, { platform: true }, async (tx) => {
      const [c] = await tx.select().from(schema.channels).where(eq(schema.channels.id, t.channelId!)).limit(1);
      return c ?? null;
    });
    const [customer] = await runWithRls(pool, { platform: false, tenantId: input.tenantId }, (tx) =>
      tx.select({ tgUserId: schema.customers.tgUserId }).from(schema.customers).where(eq(schema.customers.id, t.customerId!)).limit(1),
    );
    if (channel?.botTokenEnc && channel.tgChatId && customer?.tgUserId) {
      const tg = new TelegramApi(cipher.decrypt(channel.botTokenEnc));
      const link = await tg.createChatInviteLink(channel.tgChatId, { member_limit: 1 });
      await tg.sendMessage(customer.tgUserId, `Payment received. Your access link: ${link.invite_link}`);
      await runWithRls(pool, { platform: false, tenantId: input.tenantId }, (tx) =>
        tx.insert(schema.events).values({ tenantId: input.tenantId, customerId: t.customerId!, type: "access_granted", meta: { transactionId: t.id } }),
      );
      granted = true;
    }
  }

  return { ok: true, granted };
}
