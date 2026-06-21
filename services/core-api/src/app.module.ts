import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { ConfigService } from "@nestjs/config";
import { CsrfGuard } from "./security/csrf.guard";
import { LoggerModule } from "nestjs-pino";
import { loggerOptions } from "./observability/logger";
import { ConfigModule } from "./config/config.module";
import { DbModule } from "./db/db.module";
// import { RedisModule } from "./redis/redis.module"; // <--- کامنت شد
import { AuditModule } from "./audit/audit.module";
import { HealthModule } from "./health/health.module";
// import { RealtimeModule } from "./realtime/realtime.module"; // <--- کامنت شد
import { AuthModule } from "./auth/auth.module";
import { ChannelsModule } from "./channels/channels.module";
import { TenantDataModule } from "./tenant-data/tenant-data.module";
import { InsightsModule } from "./insights/insights.module";
import { OwnerModule } from "./owner/owner.module";
import { PlansModule } from "./plans/plans.module";
import { SettingsModule } from "./settings/settings.module";
import { ScriptModule } from "./script/script.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { QueueModule } from "./queue/queue.module";
import { CryptoModule } from "./crypto/crypto.module";
import { TelegramModule } from "./telegram/telegram.module";
import { AiModule } from "./ai/ai.module";
import { PaymentsModule } from "./payments/payments.module";
import { BillingModule } from "./billing/billing.module";
import { GrowthModule } from "./growth/growth.module";
import { FlywheelModule } from "./flywheel/flywheel.module";
import { OpsModule } from "./ops/ops.module";

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [{ ttl: 60_000, limit: 300 }],
        storage: new ThrottlerStorageRedisService(configService.get("REDIS_URL")),
      }),
    }),
    LoggerModule.forRoot(loggerOptions),
    ConfigModule,
    DbModule,
    // RedisModule, // <--- کامنت شد
    AuditModule,
    HealthModule,
    // RealtimeModule, // <--- کامنت شد
    AuthModule,
    ChannelsModule,
    TenantDataModule,
    InsightsModule,
    OwnerModule,
    PlansModule,
    SettingsModule,
    ScriptModule,
    AnalyticsModule,
    QueueModule,
    CryptoModule,
    TelegramModule,
    AiModule,
    PaymentsModule,
    BillingModule,
    GrowthModule,
    FlywheelModule,
    OpsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule {}
