"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makePaymentWatchProcessor = makePaymentWatchProcessor;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@appido/db");
const payments_1 = require("@appido/payments");
const CRYPTO = ["usdt_trc20", "usdt_bep20", "usdt_ton"];
/** Periodic scan: time out expired pending checkouts, and confirm on-chain USDT payments
 *  by polling each pending transaction's wallet, then finalize (GMV + grant access). */
function makePaymentWatchProcessor(dbh, cipher, env, log) {
    return async () => {
        if (!cipher)
            return { ok: true, checked: 0, confirmed: 0, expired: 0 };
        const now = new Date();
        const expired = await (0, db_1.runWithRls)(dbh.pool, { platform: true }, (tx) => tx
            .update(db_1.schema.transactions)
            .set({ status: "fail" })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.transactions.status, "pending"), (0, drizzle_orm_1.isNotNull)(db_1.schema.transactions.expiresAt), (0, drizzle_orm_1.lt)(db_1.schema.transactions.expiresAt, now)))
            .returning({ id: db_1.schema.transactions.id }));
        const pending = await (0, db_1.runWithRls)(dbh.pool, { platform: true }, (tx) => tx
            .select({
            id: db_1.schema.transactions.id,
            tenantId: db_1.schema.transactions.tenantId,
            gateway: db_1.schema.transactions.gateway,
            amountCents: db_1.schema.transactions.amountCents,
            currency: db_1.schema.transactions.currency,
            receipt: db_1.schema.transactions.receipt,
            at: db_1.schema.transactions.at,
        })
            .from(db_1.schema.transactions)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.transactions.status, "pending"), (0, drizzle_orm_1.inArray)(db_1.schema.transactions.gateway, CRYPTO)))
            .limit(100));
        let confirmed = 0;
        for (const t of pending) {
            const cred = await (0, db_1.runWithRls)(dbh.pool, { platform: false, tenantId: t.tenantId }, async (tx) => {
                const [c] = await tx
                    .select()
                    .from(db_1.schema.paymentCredentials)
                    .where((0, drizzle_orm_1.eq)(db_1.schema.paymentCredentials.method, t.gateway))
                    .limit(1);
                return c ?? null;
            });
            if (!cred?.secretEnc)
                continue;
            const secret = JSON.parse(cipher.decrypt(cred.secretEnc));
            const provider = (0, payments_1.resolveProvider)(t.gateway, secret, env);
            const receipt = (t.receipt ?? {});
            const v = await provider
                .verify({
                amountCents: t.amountCents,
                currency: t.currency,
                payAddress: receipt.payAddress,
                memo: receipt.memo,
                since: t.at ? new Date(t.at).toISOString() : undefined,
            })
                .catch(() => ({ status: "pending" }));
            if (v.status === "confirmed") {
                await (0, payments_1.finalizeTransaction)(dbh.pool, cipher, { tenantId: t.tenantId, transactionId: t.id, providerRef: v.providerRef });
                confirmed++;
            }
        }
        if (pending.length || expired.length)
            log.debug({ checked: pending.length, confirmed, expired: expired.length }, "payment-watch scan");
        return { ok: true, checked: pending.length, confirmed, expired: expired.length };
    };
}
//# sourceMappingURL=payment-watch.js.map