import { Global, Inject, Module, type OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { AppConfig } from "@appido/config";
import { APP_CONFIG } from "../config/config.module";

export const TG_INGEST_QUEUE = Symbol("TG_INGEST_QUEUE");
export const GROWTH_QUEUE = Symbol("GROWTH_QUEUE");

@Global()
@Module({
  providers: [
    {
      provide: TG_INGEST_QUEUE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): Queue =>
        new Queue("tg-ingest", {
          connection: new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null }),
          defaultJobOptions: { attempts: 5, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: 1000, removeOnFail: 5000 },
        }),
    },
    {
      provide: GROWTH_QUEUE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): Queue =>
        new Queue("growth", {
          connection: new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null }),
          defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: 500, removeOnFail: 1000 },
        }),
    },
  ],
  exports: [TG_INGEST_QUEUE, GROWTH_QUEUE],
})
export class QueueModule implements OnModuleDestroy {
  constructor(
    @Inject(TG_INGEST_QUEUE) private readonly tgQueue: Queue,
    @Inject(GROWTH_QUEUE) private readonly growthQueue: Queue,
  ) {}
  async onModuleDestroy(): Promise<void> {
    await this.tgQueue.close();
    await this.growthQueue.close();
  }
}
