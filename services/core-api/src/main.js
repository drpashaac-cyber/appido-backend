"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const swagger_1 = require("@nestjs/swagger");
const helmet_1 = __importDefault(require("@fastify/helmet"));
const cookie_1 = __importDefault(require("@fastify/cookie"));
const nestjs_pino_1 = require("nestjs-pino");
const config_1 = require("@appido/config");
const otel_1 = require("./observability/otel");
const all_exceptions_filter_1 = require("./common/all-exceptions.filter");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const config = (0, config_1.loadConfig)();
    await (0, otel_1.initOtel)(config);
    const app = await core_1.NestFactory.create(app_module_1.AppModule, new platform_fastify_1.FastifyAdapter({ trustProxy: true, bodyLimit: 1_048_576 }), { bufferLogs: true });
    app.useLogger(app.get(nestjs_pino_1.Logger));
    await app.register(helmet_1.default, { contentSecurityPolicy: false });
    await app.register(cookie_1.default);
    app.enableCors({ origin: config.CORS_ORIGINS, credentials: true });
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new all_exceptions_filter_1.AllExceptionsFilter());
    app.enableShutdownHooks();
    // OpenAPI contract + UI at /docs
    const doc = swagger_1.SwaggerModule.createDocument(app, new swagger_1.DocumentBuilder()
        .setTitle("APPIDO Core API")
        .setDescription("Unified backend for landing, tenant dashboard, owner console")
        .setVersion("0.1")
        .addCookieAuth("appido_session")
        .build());
    swagger_1.SwaggerModule.setup("docs", app, doc);
    await app.listen({ port: config.PORT, host: "0.0.0.0" });
    // eslint-disable-next-line no-console
    console.log(`core-api listening on :${config.PORT} (docs at /docs)`);
}
void bootstrap();
//# sourceMappingURL=main.js.map