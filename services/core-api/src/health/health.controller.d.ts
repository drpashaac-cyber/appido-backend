import type { Redis } from "ioredis";
import type { DbHandle } from "@appido/db";
export declare class HealthController {
    private readonly db;
    private readonly redis;
    constructor(db: DbHandle, redis: Redis);
    /** Liveness — process is up. */
    live(): {
        status: string;
        ts: string;
    };
    /** Readiness — dependencies reachable. */
    ready(): Promise<{
        status: string;
        db: boolean;
        redis: boolean;
    }>;
    private pingDb;
    private pingRedis;
}
