import type { Logger } from "pino";
import { type DbHandle } from "@appido/db";
import type { SecretCipher } from "@appido/crypto";
import { type PaymentEnv } from "@appido/payments";
/** Periodic scan: time out expired pending checkouts, and confirm on-chain USDT payments
 *  by polling each pending transaction's wallet, then finalize (GMV + grant access). */
export declare function makePaymentWatchProcessor(dbh: DbHandle, cipher: SecretCipher | null, env: PaymentEnv, log: Logger): () => Promise<{
    ok: boolean;
    checked: number;
    confirmed: number;
    expired: number;
}>;
