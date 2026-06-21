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
      useFactory: (config: AppConfig): Redis => new IORedis(config.REDIS_URL, {
        maxRetriesPerRequest: 5, // کاهش تعداد تلاش‌ها برای تشخیص سریع‌تر خطا
        tls: {
          rejectUnauthorized: false, // برای تست و رفع خطاهای TLS
        },
        connectTimeout: 20000, // افزایش زمان انتظار برای اتصال
        retryStrategy: (times: number) => {
          if (times > 3) {
            return null; // بعد از ۳ بار تلاش، اتصال را قطع کن
          }
          return Math.min(times * 100, 3000);
        },
      }),
    },
    {
      provide: REDIS_SUB,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): Redis => new IORedis(config.REDIS_URL, {
        maxRetriesPerRequest: 5,
        tls: {
          rejectUnauthorized: false,
        },
        connectTimeout: 20000,
        retryStrategy: (times: number) => {
          if (times > 3) {
            return null;
          }
          return Math.min(times * 100, 3000);
        },
      }),
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
