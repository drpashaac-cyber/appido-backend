import { type OnModuleDestroy } from "@nestjs/common";
import { type Redis } from "ioredis";
export declare const REDIS: unique symbol;
export declare const REDIS_SUB: unique symbol;
export declare class RedisModule implements OnModuleDestroy {
    private readonly redis;
    private readonly sub;
    constructor(redis: Redis, sub: Redis);
    onModuleDestroy(): Promise<void>;
}
