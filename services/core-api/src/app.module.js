"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const throttler_storage_redis_1 = require("@nest-lab/throttler-storage-redis");
const config_module_1 = require("./config/config.module");
const csrf_guard_1 = require("./security/csrf.guard");
const nestjs_pino_1 = require("nestjs-pino");
const logger_1 = require("./observability/logger");
const config_module_2 = require("./config/config.module");
const db_module_1 = require("./db/db.module");
const redis_module_1 = require("./redis/redis.module");
const audit_module_1 = require("./audit/audit.module");
const health_module_1 = require("./health/health.module");
const realtime_module_1 = require("./realtime/realtime.module");
const auth_module_1 = require("./auth/auth.module");
const channels_module_1 = require("./channels/channels.module");
const tenant_data_module_1 = require("./tenant-data/tenant-data.module");
const insights_module_1 = require("./insights/insights.module");
const owner_module_1 = require("./owner/owner.module");
const plans_module_1 = require("./plans/plans.module");
const settings_module_1 = require("./settings/settings.module");
const script_module_1 = require("./script/script.module");
const analytics_module_1 = require("./analytics/analytics.module");
const queue_module_1 = require("./queue/queue.module");
const crypto_module_1 = require("./crypto/crypto.module");
const telegram_module_1 = require("./telegram/telegram.module");
const ai_module_1 = require("./ai/ai.module");
const payments_module_1 = require("./payments/payments.module");
const billing_module_1 = require("./billing/billing.module");
const growth_module_1 = require("./growth/growth.module");
const flywheel_module_1 = require("./flywheel/flywheel.module");
const ops_module_1 = require("./ops/ops.module");
const owner_analytics_module_1 = require("./owner-analytics/owner-analytics.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            throttler_1.ThrottlerModule.forRootAsync({
                inject: [config_module_1.APP_CONFIG],
                useFactory: (config) => ({
                    throttlers: [{ ttl: 60_000, limit: 300 }],
                    storage: new throttler_storage_redis_1.ThrottlerStorageRedisService(config.REDIS_URL), // shared across instances
                }),
            }),
            nestjs_pino_1.LoggerModule.forRoot(logger_1.loggerOptions),
            config_module_2.ConfigModule,
            db_module_1.DbModule,
            redis_module_1.RedisModule,
            audit_module_1.AuditModule,
            health_module_1.HealthModule,
            realtime_module_1.RealtimeModule,
            auth_module_1.AuthModule,
            channels_module_1.ChannelsModule,
            tenant_data_module_1.TenantDataModule,
            insights_module_1.InsightsModule,
            owner_module_1.OwnerModule,
            plans_module_1.PlansModule,
            settings_module_1.SettingsModule,
            script_module_1.ScriptModule,
            analytics_module_1.AnalyticsModule,
            queue_module_1.QueueModule,
            crypto_module_1.CryptoModule,
            telegram_module_1.TelegramModule,
            ai_module_1.AiModule,
            payments_module_1.PaymentsModule,
            billing_module_1.BillingModule,
            growth_module_1.GrowthModule,
            flywheel_module_1.FlywheelModule,
            ops_module_1.OpsModule,
            owner_analytics_module_1.OwnerAnalyticsModule,
        ],
        providers: [
            { provide: core_1.APP_GUARD, useClass: throttler_1.ThrottlerGuard },
            { provide: core_1.APP_GUARD, useClass: csrf_guard_1.CsrfGuard },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map