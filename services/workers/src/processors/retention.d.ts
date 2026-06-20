import type { Job } from "bullmq";
import type { Logger } from "pino";
import { type DbHandle } from "@appido/db";
export declare function makeRetentionProcessor(dbh: DbHandle, log: Logger): (_job: Job) => Promise<{
    ok: boolean;
    purged: number;
    days: number;
}>;
