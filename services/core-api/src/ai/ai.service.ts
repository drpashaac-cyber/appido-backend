import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import {
  LiteLlmClient,
  buildSystemPrompt,
  indexKnowledge,
  monthToDateCostMicroUsd,
  modelForTask,
  recordUsage,
  resolveModel,
  writeCampaign,
  runAgent,
  type ChatMessage,
} from "@appido/ai";
import { runWithRls, schema, type DbHandle, type RlsContext } from "@appido/db";
import type { AppConfig } from "@appido/config";
import { DB } from "../db/db.module";
import { APP_CONFIG } from "../config/config.module";

export interface AiConfigInput {
  channelId?: string;
  model?: string;
  tone?: string;
  goal?: string;
  languages?: string[];
  guardrails?: string;
  enabled?: boolean;
}

function requireTenant(ctx: RlsContext): string {
  if (!ctx.tenantId) throw new ServiceUnavailableException("tenant_context_required");
  return ctx.tenantId;
}

@Injectable()
export class AiService {
  private cached?: LiteLlmClient;

  constructor(
    @Inject(DB) private readonly dbh: DbHandle,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private aiEnabled(): boolean {
    return process.env.APPIDO_AI_ENABLED === "true";
  }

  private requireAiEnabled(): void {
    if (!this.aiEnabled()) {
      throw new ServiceUnavailableException("ai_disabled");
    }
  }

  private client(): LiteLlmClient {
    this.requireAiEnabled();
    if (!this.cached) {
      if (!this.config.LITELLM_BASE_URL || !this.config.LITELLM_MASTER_KEY) {
        throw new ServiceUnavailableException("ai_gateway_not_configured");
      }
      this.cached = new LiteLlmClient(this.config.LITELLM_BASE_URL, this.config.LITELLM_MASTER_KEY);
    }
    return this.cached;
  }

  private async resolveChannel(ctx: RlsContext, channelId?: string) {
    const tenantId = requireTenant(ctx);
    return runWithRls(this.dbh.pool, ctx, async (tx) => {
      const rows = channelId
        ? await tx
            .select()
            .from(schema.channels)
            .where(and(eq(schema.channels.id, channelId), eq(schema.channels.tenantId, tenantId)))
            .limit(1)
        : await tx
            .select()
            .from(schema.channels)
            .where(eq(schema.channels.tenantId, tenantId))
            .orderBy(desc(schema.channels.createdAt))
            .limit(1);
      if (!rows[0]) throw new NotFoundException("channel_not_found");
      return rows[0];
    });
  }

  async getConfig(ctx: RlsContext, channelId?: string) {
    const ch = await this.resolveChannel(ctx, channelId);
    return {
      channelId: ch.id,
      model: ch.aiModel,
      tone: ch.aiTone,
      goal: ch.aiGoal,
      languages: ch.aiLanguages,
      guardrails: ch.aiGuardrails,
      enabled: ch.aiEnabled,
    };
  }

  async updateConfig(ctx: RlsContext, input: AiConfigInput) {
    const tenantId = requireTenant(ctx);
    const ch = await this.resolveChannel(ctx, input.channelId);
    await runWithRls(this.dbh.pool, ctx, (tx) =>
      tx
        .update(schema.channels)
        .set({
          aiModel: input.model ? resolveModel(input.model) : ch.aiModel,
          aiTone: input.tone ?? ch.aiTone,
          aiGoal: input.goal ?? ch.aiGoal,
          aiLanguages: input.languages ?? ch.aiLanguages,
          aiGuardrails: input.guardrails ?? ch.aiGuardrails,
          aiEnabled: input.enabled ?? ch.aiEnabled,
        })
        .where(and(eq(schema.channels.id, ch.id), eq(schema.channels.tenantId, tenantId))),
    );
    return this.getConfig(ctx, ch.id);
  }

  async indexKnowledge(ctx: RlsContext, input: { source: "file" | "product"; sourceId?: string; text: string }) {
    this.requireAiEnabled();
    const tenantId = requireTenant(ctx);
    const chunks = await indexKnowledge(this.dbh.pool, this.client(), {
      tenantId,
      source: input.source,
      sourceId: input.sourceId,
      text: input.text,
    });
    return { ok: true, chunks };
  }

  async listKnowledge(ctx: RlsContext) {
    const tenantId = requireTenant(ctx);
    return runWithRls(this.dbh.pool, ctx, (tx) =>
      tx
        .select({ id: schema.knowledgeChunks.id, source: schema.knowledgeChunks.source, sourceId: schema.knowledgeChunks.sourceId, createdAt: schema.knowledgeChunks.createdAt })
        .from(schema.knowledgeChunks)
        .where(eq(schema.knowledgeChunks.tenantId, tenantId))
        .orderBy(desc(schema.knowledgeChunks.createdAt))
        .limit(200),
    );
  }

  private async overBudget(tenantId: string): Promise<boolean> {
    const [tenant] = await runWithRls(this.dbh.pool, { platform: false, tenantId }, (tx) =>
      tx.select({ budgetCents: schema.tenants.aiBudgetCents }).from(schema.tenants).where(eq(schema.tenants.id, tenantId)).limit(1),
    );
    const budgetMicro = (tenant?.budgetCents ?? 0) * 10_000; // cents → micro-USD
    const spent = await monthToDateCostMicroUsd(this.dbh.pool, tenantId);
    return spent >= budgetMicro;
  }

  /** Server-side revenue advisor for the dashboard (replaces the client-side call). */
  async advisor(ctx: RlsContext, question: string) {
    this.requireAiEnabled();
    if (!ctx.tenantId) throw new ServiceUnavailableException("tenant_context_required");
    if (await this.overBudget(ctx.tenantId)) return { answer: "", budgetExceeded: true };
    const [tenant] = await runWithRls(this.dbh.pool, ctx, (tx) =>
      tx.select({ name: schema.tenants.name }).from(schema.tenants).where(eq(schema.tenants.id, ctx.tenantId!)).limit(1),
    );
    const model = modelForTask("advisor");
    const t0 = Date.now();
    const res = await this.client().chat({
      model,
      messages: [
        { role: "system", content: `You are a concise revenue advisor for "${tenant?.name ?? "this business"}", a Telegram business on Appido. Give specific, actionable advice. No fluff.` },
        { role: "user", content: question },
      ],
    });
    const latencyMs = Date.now() - t0;
    const msg = res.choices[0]?.message;
    if (res.usage) await recordUsage(this.dbh.pool, { tenantId: ctx.tenantId, model, usage: res.usage, task: "advisor", tier: "smart", latencyMs });
    return { answer: msg?.content ?? "", budgetExceeded: false };
  }

  /** Public marketing-site advisor — no tenant, no metering. Powers the landing support widget. */
  async advisorPublic(question: string, lang?: string) {
    this.requireAiEnabled();
    const LANGS: Record<string, string> = { en: "English", fa: "Persian (Farsi)", ar: "Arabic", tr: "Turkish", ru: "Russian" };
    const language = LANGS[lang ?? ""] ?? "English";
    const model = modelForTask("advisor");
    const res = await this.client().chat({
      model,
      messages: [
        {
          role: "system",
          content: `You are Appido's friendly AI assistant on its marketing website. Reply ONLY in ${language}, warm, concise (under 70 words), and honest. Appido turns a Telegram channel into an automated sales machine: a 24/7 AI seller that answers and follows up with leads, automatic payment confirmation, automatic product delivery, channel access management, plus CRM and reporting — all inside Telegram. Plans: Start $79/mo and Pro $179/mo, with a 30-day guarantee. Answer the visitor's question, then gently invite them to start.`,
        },
        { role: "user", content: question },
      ],
    });
    return { answer: res.choices[0]?.message?.content ?? "" };
  }

  /** Dry-run the agent against a sample inbound message (dashboard playground). */
  async test(ctx: RlsContext, message: string, customerId?: string) {
    this.requireAiEnabled();
    if (!ctx.tenantId) throw new ServiceUnavailableException("tenant_context_required");
    if (await this.overBudget(ctx.tenantId)) return { reply: "", budgetExceeded: true, steps: 0 };
    const ch = await this.resolveChannel(ctx);
    const system = buildSystemPrompt({
      tenantName: undefined,
      tone: ch.aiTone,
      goal: ch.aiGoal,
      languages: ch.aiLanguages,
      guardrails: ch.aiGuardrails,
    });
    const history: ChatMessage[] = [{ role: "user", content: message }];
    const t0 = Date.now();
    const result = await runAgent({
      client: this.client(),
      model: resolveModel(ch.aiModel),
      system,
      history,
      ctx: { pool: this.dbh.pool, client: this.client(), tenantId: ctx.tenantId, customerId, channelId: ch.id, dryRun: true },
    });
    const latencyMs = Date.now() - t0;
    await recordUsage(this.dbh.pool, { tenantId: ctx.tenantId, customerId, model: ch.aiModel, usage: result.usage, task: "chat", tier: "smart", latencyMs });
    return { reply: result.text, steps: result.steps, budgetExceeded: false };
  }

  // P6: campaign / retargeting copy (smart tier), budget-guarded + metered.
  async campaignCopy(
    ctx: RlsContext,
    input: { goal: string; audience: string; product?: string; tone?: string; language?: string },
  ): Promise<{ body: string; budgetExceeded: boolean }> {
    this.requireAiEnabled();
    if (await this.overBudget(ctx.tenantId)) return { body: "", budgetExceeded: true };
    const t0 = Date.now();
    const r = await writeCampaign(this.client(), input);
    const latencyMs = Date.now() - t0;
    if (r.usage) {
      await recordUsage(this.dbh.pool, { tenantId: ctx.tenantId, model: r.model, usage: r.usage, task: "write_campaign", tier: "smart", latencyMs });
    }
    return { body: r.body, budgetExceeded: false };
  }
}
