"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const ai_1 = require("@appido/ai");
const db_1 = require("@appido/db");
const db_module_1 = require("../db/db.module");
const config_module_1 = require("../config/config.module");
let AiService = class AiService {
    dbh;
    config;
    cached;
    constructor(dbh, config) {
        this.dbh = dbh;
        this.config = config;
    }
    client() {
        if (!this.cached) {
            if (!this.config.LITELLM_BASE_URL || !this.config.LITELLM_MASTER_KEY) {
                throw new common_1.ServiceUnavailableException("ai_gateway_not_configured");
            }
            this.cached = new ai_1.LiteLlmClient(this.config.LITELLM_BASE_URL, this.config.LITELLM_MASTER_KEY);
        }
        return this.cached;
    }
    async resolveChannel(ctx, channelId) {
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, async (tx) => {
            const rows = channelId
                ? await tx.select().from(db_1.schema.channels).where((0, drizzle_orm_1.eq)(db_1.schema.channels.id, channelId)).limit(1)
                : await tx.select().from(db_1.schema.channels).orderBy((0, drizzle_orm_1.desc)(db_1.schema.channels.createdAt)).limit(1);
            if (!rows[0])
                throw new common_1.NotFoundException("channel_not_found");
            return rows[0];
        });
    }
    async getConfig(ctx, channelId) {
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
    async updateConfig(ctx, input) {
        const ch = await this.resolveChannel(ctx, input.channelId);
        await (0, db_1.runWithRls)(this.dbh.pool, ctx, (tx) => tx
            .update(db_1.schema.channels)
            .set({
            aiModel: input.model ? (0, ai_1.resolveModel)(input.model) : ch.aiModel,
            aiTone: input.tone ?? ch.aiTone,
            aiGoal: input.goal ?? ch.aiGoal,
            aiLanguages: input.languages ?? ch.aiLanguages,
            aiGuardrails: input.guardrails ?? ch.aiGuardrails,
            aiEnabled: input.enabled ?? ch.aiEnabled,
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.channels.id, ch.id)));
        return this.getConfig(ctx, ch.id);
    }
    async indexKnowledge(ctx, input) {
        if (!ctx.tenantId)
            throw new common_1.ServiceUnavailableException("tenant_context_required");
        const chunks = await (0, ai_1.indexKnowledge)(this.dbh.pool, this.client(), {
            tenantId: ctx.tenantId,
            source: input.source,
            sourceId: input.sourceId,
            text: input.text,
        });
        return { ok: true, chunks };
    }
    async listKnowledge(ctx) {
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, (tx) => tx
            .select({ id: db_1.schema.knowledgeChunks.id, source: db_1.schema.knowledgeChunks.source, sourceId: db_1.schema.knowledgeChunks.sourceId, createdAt: db_1.schema.knowledgeChunks.createdAt })
            .from(db_1.schema.knowledgeChunks)
            .orderBy((0, drizzle_orm_1.desc)(db_1.schema.knowledgeChunks.createdAt))
            .limit(200));
    }
    async overBudget(tenantId) {
        const [tenant] = await (0, db_1.runWithRls)(this.dbh.pool, { platform: false, tenantId }, (tx) => tx.select({ budgetCents: db_1.schema.tenants.aiBudgetCents }).from(db_1.schema.tenants).where((0, drizzle_orm_1.eq)(db_1.schema.tenants.id, tenantId)).limit(1));
        const budgetMicro = (tenant?.budgetCents ?? 0) * 10_000; // cents → micro-USD
        const spent = await (0, ai_1.monthToDateCostMicroUsd)(this.dbh.pool, tenantId);
        return spent >= budgetMicro;
    }
    /** Server-side revenue advisor for the dashboard (replaces the client-side call). */
    async advisor(ctx, question) {
        if (!ctx.tenantId)
            throw new common_1.ServiceUnavailableException("tenant_context_required");
        if (await this.overBudget(ctx.tenantId))
            return { answer: "", budgetExceeded: true };
        const [tenant] = await (0, db_1.runWithRls)(this.dbh.pool, ctx, (tx) => tx.select({ name: db_1.schema.tenants.name }).from(db_1.schema.tenants).where((0, drizzle_orm_1.eq)(db_1.schema.tenants.id, ctx.tenantId)).limit(1));
        const model = (0, ai_1.modelForTask)("advisor");
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
        if (res.usage)
            await (0, ai_1.recordUsage)(this.dbh.pool, { tenantId: ctx.tenantId, model, usage: res.usage, task: "advisor", tier: "smart", latencyMs });
        return { answer: msg?.content ?? "", budgetExceeded: false };
    }
    /** Public marketing-site advisor — no tenant, no metering. Powers the landing support widget. */
    async advisorPublic(question, lang) {
        const LANGS = { en: "English", fa: "Persian (Farsi)", ar: "Arabic", tr: "Turkish", ru: "Russian" };
        const language = LANGS[lang ?? ""] ?? "English";
        const model = (0, ai_1.modelForTask)("advisor");
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
    async test(ctx, message, customerId) {
        if (!ctx.tenantId)
            throw new common_1.ServiceUnavailableException("tenant_context_required");
        if (await this.overBudget(ctx.tenantId))
            return { reply: "", budgetExceeded: true, steps: 0 };
        const ch = await this.resolveChannel(ctx);
        const system = (0, ai_1.buildSystemPrompt)({
            tenantName: undefined,
            tone: ch.aiTone,
            goal: ch.aiGoal,
            languages: ch.aiLanguages,
            guardrails: ch.aiGuardrails,
        });
        const history = [{ role: "user", content: message }];
        const t0 = Date.now();
        const result = await (0, ai_1.runAgent)({
            client: this.client(),
            model: (0, ai_1.resolveModel)(ch.aiModel),
            system,
            history,
            ctx: { pool: this.dbh.pool, client: this.client(), tenantId: ctx.tenantId, customerId, channelId: ch.id, dryRun: true },
        });
        const latencyMs = Date.now() - t0;
        await (0, ai_1.recordUsage)(this.dbh.pool, { tenantId: ctx.tenantId, customerId, model: ch.aiModel, usage: result.usage, task: "chat", tier: "smart", latencyMs });
        return { reply: result.text, steps: result.steps, budgetExceeded: false };
    }
    // P6: campaign / retargeting copy (smart tier), budget-guarded + metered.
    async campaignCopy(ctx, input) {
        if (await this.overBudget(ctx.tenantId))
            return { body: "", budgetExceeded: true };
        const t0 = Date.now();
        const r = await (0, ai_1.writeCampaign)(this.client(), input);
        const latencyMs = Date.now() - t0;
        if (r.usage) {
            await (0, ai_1.recordUsage)(this.dbh.pool, { tenantId: ctx.tenantId, model: r.model, usage: r.usage, task: "write_campaign", tier: "smart", latencyMs });
        }
        return { body: r.body, budgetExceeded: false };
    }
};
exports.AiService = AiService;
exports.AiService = AiService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(db_module_1.DB)),
    __param(1, (0, common_1.Inject)(config_module_1.APP_CONFIG)),
    __metadata("design:paramtypes", [Object, Object])
], AiService);
//# sourceMappingURL=ai.service.js.map