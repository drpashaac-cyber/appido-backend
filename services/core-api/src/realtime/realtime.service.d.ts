import { type OnModuleInit } from "@nestjs/common";
import type { Redis } from "ioredis";
import { Observable } from "rxjs";
import type { RealtimeEvent } from "@appido/types";
/**
 * Live data backbone. publish() fans out across all API instances via Redis
 * pub/sub; stream() returns a per-connection Observable scoped to one tenant.
 * Events get published by each domain as it ships (messages P3, usage P4, payments P5).
 */
export declare class RealtimeService implements OnModuleInit {
    private readonly redis;
    private readonly sub;
    private readonly subjects;
    constructor(redis: Redis, sub: Redis);
    onModuleInit(): void;
    publish(event: RealtimeEvent): Promise<void>;
    stream(tenantId: string): Observable<RealtimeEvent>;
}
