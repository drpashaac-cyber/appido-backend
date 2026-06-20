// Identity (P1) + full domain (P2). Business invariants baked in:
//  - subscriptions = APPIDO MRR  ·  transactions = tenant GMV  (never mixed)
//  - products = the tenant's OWN catalog (own price/duration)
//  - money stored as INTEGER minor units (*_cents) + explicit currency — no floats
//  - every tenant-scoped table carries tenant_id and is protected by RLS
import {
  pgTable, text, timestamp, uuid, boolean, integer, bigint, jsonb, pgEnum, index, uniqueIndex, vector,
} from "drizzle-orm/pg-core";

/* ---------- enums ---------- */
export const userRole = pgEnum("user_role", [
  "owner", "manager", "marketer", "finance", "support", "trust", "tenant_admin", "tenant_member",
]);
export const loginMethod = pgEnum("login_method", ["password", "code"]);
export const userStatus = pgEnum("user_status", ["active", "suspended", "invited"]);
export const customerTag = pgEnum("customer_tag", ["hot", "warm", "cold", "vip"]);
export const msgDirection = pgEnum("msg_direction", ["in", "out"]);
export const msgAuthor = pgEnum("msg_author", ["customer", "ai", "human"]);
export const subPlan = pgEnum("sub_plan", ["start", "pro", "trial"]);
export const subStatus = pgEnum("sub_status", ["trialing", "active", "past_due", "canceled"]);
export const txStatus = pgEnum("tx_status", ["pending", "ok", "fail"]);
export const payMethod = pgEnum("pay_method", [
  "zarinpal", "idpay", "nextpay", "stripe", "paypal", "usdt_trc20", "usdt_bep20", "usdt_ton", "card",
]);
export const payKind = pgEnum("pay_kind", ["key", "wallet", "manual"]);
export const knowledgeSource = pgEnum("knowledge_source", ["file", "product"]);
export const campaignStatus = pgEnum("campaign_status", ["draft", "scheduled", "sending", "sent", "failed"]);

/* ---------- meta / identity (P1) ---------- */
export const appMeta = pgTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  country: text("country"),
  timezone: text("timezone").notNull().default("UTC"),
  locale: text("locale").notNull().default("en"),
  currency: text("currency").notNull().default("USD"),
  aiBudgetCents: integer("ai_budget_cents").notNull().default(1000),
  aiVirtualKeyEnc: text("ai_virtual_key_enc"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    role: userRole("role").notNull(),
    status: userStatus("status").notNull().default("active"),
    method: loginMethod("method").notNull().default("code"),
    passwordHash: text("password_hash"),
    mustRotate: boolean("must_rotate").notNull().default(false),
    twofaEnabled: boolean("twofa_enabled").notNull().default(false),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("users_tenant_idx").on(t.tenantId)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    impersonatingTenantId: uuid("impersonating_tenant_id").references(() => tenants.id),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const loginCodes = pgTable(
  "login_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    purpose: text("purpose").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("login_codes_user_idx").on(t.userId)],
);

export const channels = pgTable(
  "channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    username: text("username"),
    members: integer("members").notNull().default(0),
    botTokenEnc: text("bot_token_enc"),
    botSecret: text("bot_secret"),
    botId: bigint("bot_id", { mode: "number" }),
    botUsername: text("bot_username"),
    tgChatId: bigint("tg_chat_id", { mode: "number" }),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    aiModel: text("ai_model").notNull().default("claude"), // claude | gpt | gemini
    aiTone: text("ai_tone"),
    aiGoal: text("ai_goal"),
    aiLanguages: text("ai_languages").array(),
    aiEnabled: boolean("ai_enabled").notNull().default(true),
    onboardingEnabled: boolean("onboarding_enabled").notNull().default(true), // opt out of the platform onboarding script
    aiGuardrails: text("ai_guardrails"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("channels_tenant_idx").on(t.tenantId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    tenantId: uuid("tenant_id"),
    action: text("action").notNull(),
    target: text("target"),
    meta: jsonb("meta"),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("audit_log_at_idx").on(t.at)],
);

/* ---------- domain (P2) ---------- */
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id").references(() => channels.id, { onDelete: "set null" }),
    tgUserId: bigint("tg_user_id", { mode: "number" }),
    handle: text("handle"),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    tag: customerTag("tag").notNull().default("cold"),
    segment: text("segment"),
    locale: text("locale"),
    intent: integer("intent").notNull().default(0), // 0..100
    ltvCents: integer("ltv_cents").notNull().default(0),
    points: integer("points").notNull().default(0),
    tags: text("tags").array(),
    isVip: boolean("is_vip").notNull().default(false),
    vipUntil: timestamp("vip_until", { withTimezone: true }),
    profile: jsonb("profile").$type<Record<string, unknown>>().notNull().default({}), // onboarding answers keyed by appido_script.key
    aiManaged: boolean("ai_managed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("customers_tenant_idx").on(t.tenantId), index("customers_intent_idx").on(t.tenantId, t.intent)],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // open registry (see EVENT_TYPES in @appido/types)
    amountCents: integer("amount_cents"),
    currency: text("currency"),
    meta: jsonb("meta"),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("events_tenant_at_idx").on(t.tenantId, t.at), index("events_customer_idx").on(t.customerId)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id").references(() => channels.id, { onDelete: "set null" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }),
    direction: msgDirection("direction").notNull(),
    body: text("body").notNull(),
    author: msgAuthor("author").notNull(),
    tgMessageId: bigint("tg_message_id", { mode: "number" }),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    readAt: timestamp("read_at", { withTimezone: true }),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("messages_tenant_at_idx").on(t.tenantId, t.at), index("messages_customer_idx").on(t.customerId)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    currency: text("currency").notNull().default("USD"),
    durationDays: integer("duration_days"),
    description: text("description"),
    doc: text("doc"), // knowledge text for the AI agent (indexed in P4)
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("products_tenant_idx").on(t.tenantId)],
);

// APPIDO subscription = MRR (what the tenant pays APPIDO). NEVER tenant GMV.
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    plan: text("plan").notNull(), // text so owner-defined plans are subscribable; validated against appido_plans
    status: subStatus("status").notNull().default("trialing"),
    periodStart: timestamp("period_start", { withTimezone: true }).defaultNow().notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    amountCents: integer("amount_cents").notNull().default(0),
    currency: text("currency").notNull().default("USD"),
    gateway: text("gateway"),
    activationCode: text("activation_code"),
    providerRef: text("provider_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("subscriptions_tenant_idx").on(t.tenantId)],
);

// Appido's OWN subscription plan catalog — the single source of truth shared by the owner console
// (manage), the landing page (display), and the dashboard (display + checkout). NEVER tenant products.
export const appidoPlans = pgTable("appido_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(), // start / pro / custom slug
  name: text("name").notNull(),
  descFa: text("desc_fa"),
  descEn: text("desc_en"),
  priceCents: integer("price_cents").notNull().default(0), // monthly
  annualCents: integer("annual_cents"), // optional explicit annual total
  currency: text("currency").notNull().default("USD"),
  periodDays: integer("period_days").notNull().default(30),
  featuresFa: jsonb("features_fa").notNull().default([]),
  featuresEn: jsonb("features_en").notNull().default([]),
  popular: boolean("popular").notNull().default(false),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Platform gateway policy — the owner enables/disables a payment method for ALL tenants.
// Absence of a row means enabled (registry default). Platform-wide, not tenant-scoped.
export const appidoGatewayPolicy = pgTable("appido_gateway_policy", {
  method: text("method").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Platform-wide settings as a reusable key-value store (owner manages; some keys are public).
// e.g. { key: "trial_days", value: 14 }. Platform-wide, not tenant-scoped.
export const appidoSettings = pgTable("appido_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Owner-curated onboarding questions the tenant AI works through with new leads (platform; NO RLS).
export const appidoScript = pgTable(
  "appido_script",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull().unique(),
    category: text("category").notNull().default("onboard"), // onboard | qualify | objection
    questionFa: text("question_fa").notNull(),
    questionEn: text("question_en").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    enabled: boolean("enabled").notNull().default(true), // owner pause toggle
    active: boolean("active").notNull().default(true), // soft delete
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("appido_script_order_idx").on(t.sortOrder)],
);

// Appido subscription activation codes (Founder-Led-Sales / resellers / comps). Platform-only.
export const activationCodes = pgTable("activation_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  plan: subPlan("plan").notNull(),
  durationDays: integer("duration_days").notNull().default(30),
  note: text("note"),
  redeemedByTenant: uuid("redeemed_by_tenant").references(() => tenants.id, { onDelete: "set null" }),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Tenant sales = GMV (what the tenant's customers pay the tenant). NEVER APPIDO MRR.
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id").references(() => channels.id, { onDelete: "set null" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    gateway: text("gateway").notNull(),
    status: txStatus("status").notNull().default("pending"),
    providerRef: text("provider_ref"),
    receipt: jsonb("receipt"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("transactions_tenant_at_idx").on(t.tenantId, t.at),
    index("transactions_provider_uq").on(t.gateway, t.providerRef),
  ],
);

// The tenant's OWN gateway connectors (BYO key/wallet). secret_enc = envelope-encrypted (P5).
export const paymentCredentials = pgTable(
  "payment_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    method: text("method").notNull(), // registry-driven (see @appido/payments registry); free-form so new gateways need no migration
    kind: payKind("kind").notNull(),
    secretEnc: text("secret_enc"),
    enabled: boolean("enabled").notNull().default(false),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("pay_cred_tenant_idx").on(t.tenantId)],
);

// Token meter (mirrors LiteLLM spend logs). cost stored as micro-USD (bigint) — no floats.
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    model: text("model").notNull(),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    costMicroUsd: bigint("cost_micro_usd", { mode: "number" }).notNull().default(0),
    requestId: text("request_id"),
    task: text("task"),
    tier: text("tier"),
    latencyMs: integer("latency_ms"),
    outcome: text("outcome"),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("ai_usage_tenant_at_idx").on(t.tenantId, t.at)],
);

// RAG store (pgvector). Embeddings populated in P4.
export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    source: knowledgeSource("source").notNull(),
    sourceId: uuid("source_id"),
    chunkText: text("chunk_text").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("knowledge_tenant_idx").on(t.tenantId)],
);

// Landing funnel events (anonymous; NOT tenant-scoped, no RLS).
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    anonId: text("anon_id"),
    props: jsonb("props"),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("analytics_at_idx").on(t.at)],
);

// Idempotent webhook dedup (system table, no RLS).
export const tgProcessedUpdates = pgTable(
  "tg_processed_updates",
  {
    channelId: uuid("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
    updateId: bigint("update_id", { mode: "number" }).notNull(),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("tg_processed_pk").on(t.channelId, t.updateId)],
);

// Per-customer, per-purpose consent (GDPR-style). Tenant-scoped (RLS).
export const customerConsent = pgTable(
  "customer_consent",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(), // marketing | ai | analytics
    granted: boolean("granted").notNull().default(false),
    source: text("source"), // bot | operator | import | landing
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("customer_consent_uq").on(t.tenantId, t.customerId, t.purpose),
    index("customer_consent_customer_idx").on(t.customerId),
  ],
);

// Customer-360 identity seam: canonical customer <- many channel identities.
export const customerIdentities = pgTable(
  "customer_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // telegram | email | phone | web | whatsapp
    value: text("value").notNull(),
    verified: boolean("verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("customer_identity_uq").on(t.tenantId, t.kind, t.value),
    index("customer_identity_customer_idx").on(t.customerId),
  ],
);

// ---- P6 growth/automation ----
export const segments = pgTable(
  "segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    criteria: jsonb("criteria").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("segments_tenant_idx").on(t.tenantId)],
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id").references(() => channels.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    goal: text("goal"),
    body: text("body"),
    segmentId: uuid("segment_id").references(() => segments.id, { onDelete: "set null" }),
    criteria: jsonb("criteria").$type<Record<string, unknown>>(),
    status: campaignStatus("status").notNull().default("draft"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    stats: jsonb("stats").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("campaigns_tenant_idx").on(t.tenantId, t.createdAt)],
);

export const campaignSends = pgTable(
  "campaign_sends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending"),
    error: text("error"),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("campaign_sends_campaign_idx").on(t.campaignId, t.status)],
);

// ---- P7 flywheel / eval (platform-only) ----
export const goldenCases = pgTable(
  "golden_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    task: text("task").notNull(),
    input: text("input").notNull(),
    expected: text("expected").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("golden_cases_task_idx").on(t.task)],
);

export const evalRuns = pgTable(
  "eval_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    task: text("task").notNull(),
    model: text("model").notNull(),
    total: integer("total").notNull().default(0),
    passed: integer("passed").notNull().default(0),
    avgScore: integer("avg_score").notNull().default(0),
    detail: jsonb("detail").$type<Record<string, unknown>[]>(),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("eval_runs_task_idx").on(t.task, t.at)],
);

// ---- P8 hardening: outbox + dead letters ----
export const outbox = pgTable(
  "outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("outbox_unpublished_idx").on(t.createdAt)],
);

export const deadLetters = pgTable(
  "dead_letters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    queue: text("queue").notNull(),
    jobName: text("job_name"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    error: text("error"),
    failedAt: timestamp("failed_at", { withTimezone: true }).defaultNow().notNull(),
    replayedAt: timestamp("replayed_at", { withTimezone: true }),
  },
  (t) => [index("dead_letters_failed_idx").on(t.failedAt)],
);
