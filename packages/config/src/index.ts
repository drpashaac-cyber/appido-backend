import { z } from "zod";

const bool = (def: boolean) =>
  z.string().optional().transform((v) => (v === undefined ? def : v === "true"));

/** Single source of truth for environment configuration. Fails fast on boot. */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  CORS_ORIGINS: z
    .string()
    .default("*")
    .transform((s): true | string[] => (s.trim() === "*" ? true : s.split(",").map((o) => o.trim()))),

  // Data
  DATABASE_URL: z.string().url(),
  APP_DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url(),
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:8080"),
  TELEGRAM_API_BASE: z.string().url().default("https://api.telegram.org"),

  // AI gateway
  LITELLM_BASE_URL: z.string().url().optional(),
  LITELLM_MASTER_KEY: z.string().optional(),
  TRON_API_KEY: z.string().optional(),
  BSCSCAN_API_KEY: z.string().optional(),
  TON_API_KEY: z.string().optional(),
  APPIDO_PAY_METHOD: z.string().default("zarinpal"),
  APPIDO_PAY_SECRET: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),

  // Secrets
  SECRETS_MASTER_KEY: z.string().min(32).optional(),
  SECRETS_MASTER_KEYS: z.string().optional(),

  // Identity / sessions
  OWNER_EMAIL: z.string().email().default("appido.co@gmail.com"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(168),
  CODE_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  COOKIE_SECURE: bool(false),
  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
  COOKIE_DOMAIN: z.string().optional(),
  EMAIL_FROM: z.string().default("APPIDO <no-reply@appido.io>"),
  RESEND_API_KEY: z.string().optional(),

  // Observability
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
});

export type AppConfig = z.infer<typeof schema>;

let cached: AppConfig | null = null;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (cached) return cached;
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  }
  cached = parsed.data;
  return cached;
}

export function resetConfigCache(): void {
  cached = null;
}
