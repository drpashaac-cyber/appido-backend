import type { Logger } from "pino";
import { and, eq, inArray, isNotNull, lt } from "drizzle-orm";
import { runWithRls, schema, type DbHandle } from "@appido/db";
import type { SecretCipher } from "@appido/crypto";
import { finalizeTransaction, resolveProvider, type PaymentEnv, type PayMethod } from "@appido/payments";

const CRYPTO = ["usdt_trc20", "usdt_bep20", "usdt_ton"] as const;

/** Periodic scan: time out expired pending checkouts, and confirm on-chain USDT payments
 *  by polling each pending transaction's wallet, then finalize (GMV + grant access). */
export function makePaymentWatchProcessor(
  dbh: DbHandle,
  cipher: SecretCipher | null,
  env: PaymentEnv,
  log: Logger,
) {
  return async (): Promise<{ ok: boolean; checked: number; confirmed: number; expired: number }> => {
    if (!cipher) return { ok: true, checked: 0, confirmed: 0, expired: 0 };
    const now = new Date();

    const expired = await runWithRls(dbh.pool, { platform: true }, (tx) =>
      tx
        .update(schema.transactions)
        .set({ status: "fail" })
        .where(and(eq(schema.transactions.status, "pending"), isNotNull(schema.transactions.expiresAt), lt(schema.transactions.expiresAt, now)))
        .returning({ id: schema.transactions.id }),
    );

    const pending = await runWithRls(dbh.pool, { platform: true }, (tx) =>
      tx
        .select({
          id: schema.transactions.id,
          tenantId: schema.transactions.tenantId,
          gateway: schema.transactions.gateway,
          amountCents: schema.transactions.amountCents,
          currency: schema.transactions.currency,
          receipt: schema.transactions.receipt,
          at: schema.transactions.at,
        })
        .from(schema.transactions)
        .where(and(eq(schema.transactions.status, "pending"), inArray(schema.transactions.gateway, CRYPTO as unknown as string[])))
        .limit(100),
    );

    let confirmed = 0;
    for (const t of pending) {
      const cred = await runWithRls(dbh.pool, { platform: false, tenantId: t.tenantId }, async (tx) => {
        const [c] = await tx
          .select()
          .from(schema.paymentCredentials)
          .where(eq(schema.paymentCredentials.method, t.gateway as PayMethod))
          .limit(1);
        return c ?? null;
      });
      if (!cred?.secretEnc) continue;

      const secret = JSON.parse(cipher.decrypt(cred.secretEnc)) as Record<string, unknown>;
      const provider = resolveProvider(t.gateway as PayMethod, secret, env);
      const receipt = (t.receipt ?? {}) as { payAddress?: string; memo?: string };
      const v = await provider
        .verify({
          amountCents: t.amountCents,
          currency: t.currency,
          payAddress: receipt.payAddress,
          memo: receipt.memo,
          since: t.at ? new Date(t.at).toISOString() : undefined,
        })
        .catch(() => ({ status: "pending" as const }));

      if (v.status === "confirmed") {
        await finalizeTransaction(dbh.pool, cipher, { tenantId: t.tenantId, transactionId: t.id, providerRef: v.providerRef });
        confirmed++;
      }
    }

    if (pending.length || expired.length) log.debug({ checked: pending.length, confirmed, expired: expired.length }, "payment-watch scan");
    return { ok: true, checked: pending.length, confirmed, expired: expired.length };
  };
}
