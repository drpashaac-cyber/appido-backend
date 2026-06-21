import type { Params } from "nestjs-pino";

/** Structured logging; always carries tenantId; redacts secrets. */
export const loggerOptions: Params = {
  pinoHttp: {
    level: process.env.LOG_LEVEL || "info",
    transport:
      process.env.NODE_ENV !== "production"
        ? { target: "pino-pretty", options: { singleLine: true } }
        : undefined,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "*.bot_token",
        "*.botToken",
        "*.secret",
        "*.password",
        "*.api_key",
      ],
      censor: "[redacted]",
    },
    customProps: (req: unknown) => ({ tenantId: (req as { tenantId?: string }).tenantId }),
  },
};
