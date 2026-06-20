import { Global, Module, type OnModuleDestroy, Inject } from "@nestjs/common";
import IORedis, { type Redis } from "ioredis";
import type { AppConfig } from "@appido/config";
import { APP_CONFIG } from "../config/config.module";

export const REDIS = Symbol("REDIS");
export const REDIS_SUB = Symbol("REDIS_SUB");

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): Redis => new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null }),
    },
    {
      provide: REDIS_SUB,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): Redis => new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null }),
    },
  ],
  exports: [REDIS, REDIS_SUB],
})
export class RedisModule implements OnModuleDestroy {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(REDIS_SUB) private readonly sub: Redis,
  ) {}
  async onModuleDestroy(): Promise<void> {
    this.redis.disconnect();
    this.sub.disconnect();
  }
}
