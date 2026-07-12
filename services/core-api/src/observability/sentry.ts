import * as Sentry from "@sentry/node";

let initialized = false;

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    release: process.env.SENTRY_RELEASE || "appido-backend",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.05"),
  });

  initialized = true;
}

export function captureException(exception: unknown): void {
  if (!initialized) return;

  if (exception instanceof Error) {
    Sentry.captureException(exception);
    return;
  }

  Sentry.captureException(new Error(typeof exception === "string" ? exception : "non_error_exception"));
}
