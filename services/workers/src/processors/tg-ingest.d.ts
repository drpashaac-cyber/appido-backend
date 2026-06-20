import type { Job, Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { Logger } from "pino";
import { type DbHandle } from "@appido/db";
import type { TgUpdate } from "@appido/telegram";
export interface TgIngestJob {
    channelId: string;
    tenantId: string;
    update: TgUpdate;
}
export declare function makeTgIngestProcessor(dbh: DbHandle, pub: Redis, aiReplyQueue: Queue, log: Logger): (job: Job<TgIngestJob>) => Promise<{
    ok: boolean;
    skipped?: boolean;
}>;
