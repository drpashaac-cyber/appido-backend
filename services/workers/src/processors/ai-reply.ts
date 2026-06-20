import type { Job } from "bullmq";
import type { Redis } from "ioredis";
import type { Logger } from "pino";
import { and, asc, eq } from "drizzle-orm";
import {
  buildSystemPrompt,
  modelForTier,
  monthToDateCostMicroUsd,
  redactForLlm,
  routeModel,
  type PiiMode,
  recordUsage,
  replyRoute,
  resolveModel,
  runAgent,
  type ChatMessage,
  type LiteLlmClient,
} from "@appido/ai";
import type { SecretCipher } from "@appido/crypto";
import type { PaymentEnv } from "@appido/payments";
import { TelegramApi } from "@appido/telegram";
import { runWithRls, schema, type DbHandle } from "@appido/db";

export interface AiReplyJob {
  channelId: string;
  tenantId: string;
  customerId: string;
}

/**
 * The AI seller/support agent. Loads channel + customer + conversation, runs the
 * tool-using agent, replies in the customer's Telegram DM, and meters tokens.
 * Skips cleanly when AI is disabled, the customer is human-handled, or over budget.
 */
// Whether AI handling requires explicit customer consent (cached).
let aiConsentCache: { at: number; on: boolean } | null = null;
async function loadAiConsentRequired(dbh: DbHandle): Promise<boolean> {
  if (aiConsentCache && Date.now() - aiConsentCache.at < 60_000) return aiConsentCache.on;
  const [row] = await runWithRls(dbh.pool, { platform: true }, (tx) =>
    tx.select({ value: schema.appidoSettings.value }).from(schema.appidoSettings).where(eq(schema.appidoSettings.key, "ai_requires_consent")).limit(1),
  );
  const v = row?.value as unknown;
  const on = v === true || v === "true";
  aiConsentCache = { at: Date.now(), on };
  return on;
}

// Platform residency region, cached briefly. Routes LLM calls to a region-appropriate model when infra
// has configured one (see REGION_MODELS). "global" (default) is a pass-through.
let regionCache: { at: number; region: string } | null = null;
async function loadResidency(dbh: DbHandle): Promise<string> {
  if (regionCache && Date.now() - regionCache.at < 60_000) return regionCache.region;
  const [row] = await runWithRls(dbh.pool, { platform: true }, (tx) =>
    tx.select({ value: schema.appidoSettings.value }).from(schema.appidoSettings).where(eq(schema.appidoSettings.key, "residency")).limit(1),
  );
  const region = typeof row?.value === "string" && row.value ? row.value : "global";
  regionCache = { at: Date.now(), region };
  return region;
}

// Platform PII-redaction policy, cached briefly. Masks customer text before it reaches the LLM.
let piiCache: { at: number; mode: PiiMode } | null = null;
async function loadPiiMode(dbh: DbHandle): Promise<PiiMode> {
  if (piiCache && Date.now() - piiCache.at < 60_000) return piiCache.mode;
  const [row] = await runWithRls(dbh.pool, { platform: true }, (tx) =>
    tx.select({ value: schema.appidoSettings.value }).from(schema.appidoSettings).where(eq(schema.appidoSettings.key, "pii_redaction")).limit(1),
  );
  const v = row?.value as unknown;
  const mode: PiiMode = v === "off" || v === "mask_at_rest" ? v : "mask_before_llm";
  piiCache = { at: Date.now(), mode };
  return mode;
}

// Platform onboarding script, cached briefly (changes are infrequent; owner edits via the console).
let scriptCache: { at: number; rows: { key: string; question: string }[] } | null = null;
async function loadOnboardingScript(dbh: DbHandle): Promise<{ key: string; question: string }[]> {
  if (scriptCache && Date.now() - scriptCache.at < 60_000) return scriptCache.rows;
  const rows = await runWithRls(dbh.pool, { platform: true }, (tx) =>
    tx
      .select({ key: schema.appidoScript.key, fa: schema.appidoScript.questionFa, en: schema.appidoScript.questionEn })
      .from(schema.appidoScript)
      .where(and(eq(schema.appidoScript.active, true), eq(schema.appidoScript.enabled, true)))
      .orderBy(asc(schema.appidoScript.sortOrder)),
  );
  scriptCache = { at: Date.now(), rows: rows.map((r) => ({ key: r.key, question: r.en || r.fa || r.key })) };
  return scriptCache.rows;
}

export function makeAiReplyProcessor(
  dbh: DbHandle,
  pub: Redis,
  client: LiteLlmClient | null,
  cipher: SecretCipher | null,
  pay: { publicBaseUrl?: string; paymentEnv?: PaymentEnv },
  log: Logger,
) {
  return async (job: Job<AiReplyJob>): Promise<{ ok: boolean; skipped?: boolean }> => {
    if (!client || !cipher) return { ok: true, skipped: true }; // AI gateway not configured
    const { channelId, tenantId, customerId } = job.data;

    const channel = await runWithRls(dbh.pool, { platform: true }, async (tx) => {
      const [c] = await tx.select().from(schema.channels).where(eq(schema.channels.id, channelId)).limit(1);
      return c ?? null;
    });
    if (!channel || !channel.aiEnabled || !channel.botTokenEnc) return { ok: true, skipped: true };

    const customer = await runWithRls(dbh.pool, { platform: false, tenantId }, async (tx) => {
      const [c] = await tx.select().from(schema.customers).where(eq(schema.customers.id, customerId)).limit(1);
      return c ?? null;
    });
    if (!customer || !customer.aiManaged || !customer.tgUserId) return { ok: true, skipped: true };

    const [tenant] = await runWithRls(dbh.pool, { platform: false, tenantId }, (tx) =>
      tx
        .select({ name: schema.tenants.name, budgetCents: schema.tenants.aiBudgetCents })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1),
    );
    const spent = await monthToDateCostMicroUsd(dbh.pool, tenantId);
    if (spent >= (tenant?.budgetCents ?? 0) * 10_000) {
      log.warn({ tenantId }, "ai budget reached; skipping reply");
      return { ok: true, skipped: true };
    }

    const rows = await runWithRls(dbh.pool, { platform: false, tenantId }, (tx) =>
      tx
        .select({ direction: schema.messages.direction, body: schema.messages.body })
        .from(schema.messages)
        .where(eq(schema.messages.customerId, customerId))
        .orderBy(asc(schema.messages.at))
        .limit(20),
    );
    const piiMode = await loadPiiMode(dbh);
    const history: ChatMessage[] = rows.map((m) => ({
      role: m.direction === "in" ? "user" : "assistant",
      content: redactForLlm(m.body, piiMode),
    }));
    if (history.length === 0) return { ok: true, skipped: true };

    const telegram = new TelegramApi(cipher.decrypt(channel.botTokenEnc));
    let onboarding: { key: string; question: string }[] = [];
    if (channel.onboardingEnabled) {
      const answered = new Set(Object.keys(((customer.profile as Record<string, unknown>) ?? {})));
      onboarding = (await loadOnboardingScript(dbh)).filter((q) => !answered.has(q.key));
    }
    let requireAiConsent = false;
    if (await loadAiConsentRequired(dbh)) {
      const [cc] = await runWithRls(dbh.pool, { platform: false, tenantId }, (tx) =>
        tx
          .select({ granted: schema.customerConsent.granted })
          .from(schema.customerConsent)
          .where(and(eq(schema.customerConsent.customerId, customerId), eq(schema.customerConsent.purpose, "ai")))
          .limit(1),
      );
      requireAiConsent = !(cc?.granted === true);
    }
    const system = buildSystemPrompt({
      tenantName: tenant?.name ?? null,
      tone: channel.aiTone,
      goal: channel.aiGoal,
      languages: channel.aiLanguages,
      guardrails: channel.aiGuardrails,
      onboarding,
      requireAiConsent,
    });

    const t0 = Date.now();
    // Hybrid routing: routine customers are handled by the cheap/local `fast` tier; high-intent or
    // VIP customers escalate to the tenant's `smart` model. Keeps automation affordable at scale.
    const route = replyRoute({ intent: customer.intent, isVip: customer.isVip });
    const region = await loadResidency(dbh);
    const replyModel = routeModel(route.tier === "smart" ? resolveModel(channel.aiModel) : modelForTier("fast"), region);
    // Best-effort "typing…" so the customer sees the bot is responding (never blocks the reply).
    await telegram.sendChatAction(customer.tgUserId, "typing").catch(() => undefined);
    const result = await runAgent({
      client,
      model: replyModel,
      system,
      history,
      ctx: {
        pool: dbh.pool,
        client,
        tenantId,
        customerId,
        channelId,
        telegram,
        tgChatId: channel.tgChatId ?? null,
        cipher,
        publicBaseUrl: pay.publicBaseUrl,
        paymentEnv: pay.paymentEnv,
        publish: async (e) => {
          await pub.publish(
            `rt:${tenantId}`,
            JSON.stringify({ type: e.type, tenantId, at: new Date().toISOString(), payload: e.payload }),
          );
        },
      },
    });

    const latencyMs = Date.now() - t0;
    await recordUsage(dbh.pool, { tenantId, customerId, model: replyModel, usage: result.usage, requestId: String(job.id ?? ""), task: route.task, tier: route.tier, latencyMs });

    if (result.text.trim()) {
      await telegram.sendMessage(customer.tgUserId, result.text);
      await runWithRls(dbh.pool, { platform: false, tenantId }, async (tx) => {
        await tx.insert(schema.messages).values({ tenantId, channelId, customerId, direction: "out", body: result.text, author: "ai" });
        await tx.insert(schema.events).values({ tenantId, customerId, type: "message" });
      });
      await pub.publish(
        `rt:${tenantId}`,
        JSON.stringify({ type: "message.created", tenantId, at: new Date().toISOString(), payload: { author: "ai" } }),
      );
    }
    log.debug({ tenantId, channelId, steps: result.steps }, "ai reply processed");
    return { ok: true };
  };
}
