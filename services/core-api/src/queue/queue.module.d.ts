import { type OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
export declare const TG_INGEST_QUEUE: unique symbol;
export declare const GROWTH_QUEUE: unique symbol;
export declare class QueueModule implements OnModuleDestroy {
    private readonly tgQueue;
    private readonly growthQueue;
    constructor(tgQueue: Queue, growthQueue: Queue);
    onModuleDestroy(): Promise<void>;
}
