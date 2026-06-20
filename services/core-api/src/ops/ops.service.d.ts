import { Queue } from "bullmq";
import { type DbHandle, type RlsContext } from "@appido/db";
import type { AppConfig } from "@appido/config";
export declare class OpsService {
    private readonly dbh;
    private readonly config;
    private readonly growthQueue;
    constructor(dbh: DbHandle, config: AppConfig, growthQueue: Queue);
    listDeadLetters(_ctx: RlsContext): Promise<{
        error: string;
        id: string;
        payload: Record<string, unknown>;
        queue: string;
        jobName: string;
        failedAt: Date;
        replayedAt: Date;
    }[]>;
    replay(_ctx: RlsContext, id: string): Promise<{
        ok: boolean;
    }>;
    rotateSecrets(_ctx: RlsContext): Promise<{
        accepted: boolean;
    }>;
}
