import type { Job } from "bullmq";
import type { Redis } from "ioredis";
import type { Logger } from "pino";
import { type LiteLlmClient } from "@appido/ai";
import type { SecretCipher } from "@appido/crypto";
import type { PaymentEnv } from "@appido/payments";
import { type DbHandle } from "@appido/db";
export interface AiReplyJob {
    channelId: string;
    tenantId: string;
    customerId: string;
}
export declare function makeAiReplyProcessor(dbh: DbHandle, pub: Redis, client: LiteLlmClient | null, cipher: SecretCipher | null, pay: {
    publicBaseUrl?: string;
    paymentEnv?: PaymentEnv;
}, log: Logger): (job: Job<AiReplyJob>) => Promise<{
    ok: boolean;
    skipped?: boolean;
}>;
