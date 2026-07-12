import "reflect-metadata";
import "dotenv/config";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import { Logger } from "nestjs-pino";
import { loadConfig } from "@appido/config";
import { initOtel } from "./observability/otel";
import { initSentry } from "./observability/sentry";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  initSentry();
  await initOtel(config);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true, bodyLimit: 1_048_576 }),
    { bufferLogs: true },
  );

  app.useLogger(app.get(Logger));
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        imgSrc: ["'self'", "data:"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
      },
    },
  });
  await app.register(cookie);

  const allowedCorsOrigins = new Set(config.CORS_ORIGINS);
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow: boolean) => void) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, allowedCorsOrigins.has(origin));
    },
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  if (config.NODE_ENV !== "production") {
    // OpenAPI contract + UI at /docs for local/dev only.
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("APPIDO Core API")
        .setDescription("Unified backend for landing, tenant dashboard, owner console")
        .setVersion("0.1")
        .addCookieAuth("appido_session")
        .build(),
    );
    SwaggerModule.setup("docs", app, doc);
  }

  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  // eslint-disable-next-line no-console
  console.log(`core-api listening on :${config.PORT}`);
}

void bootstrap();
