"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggerOptions = void 0;
/** Structured logging; always carries tenantId; redacts secrets. */
exports.loggerOptions = {
    pinoHttp: {
        level: process.env.LOG_LEVEL || "info",
        transport: process.env.NODE_ENV !== "production"
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
        customProps: (req) => ({ tenantId: req.tenantId }),
    },
};
//# sourceMappingURL=logger.js.map