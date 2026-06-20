"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeAiReplyProcessor = makeAiReplyProcessor;
const drizzle_orm_1 = require("drizzle-orm");
const ai_1 = require("@appido/ai");
const telegram_1 = require("@appido/telegram");
const db_1 = require("@appido/db");
/**
 * The AI seller/support agent. Loads channel + customer + conversation, runs the
 * tool-using agent, replies in the customer's Telegram DM, and meters tokens.
 * Skips cleanly when AI is disabled, the customer is human-handled, or over budget.
 */
// Whether AI handling requires explicit customer consent (cached).
let aiConsentCache = null;
async function loadAiConsentRequired(dbh) {
    if (aiConsentCache && Date.now() - aiConsentCache.at < 60_000)
        return aiConsentCache.on;
    const [row] = await (0, db_1.runWithRls)(dbh.pool, { platform: true }, (tx) => tx.select({ value: db_1.schema.appidoSettings.value }).from(db_1.schema.appidoSettings).where((0, drizzle_orm_1.eq)(db_1.schema.appidoSettings.key, "ai_requires_consent")).limit(1));
    const v = row?.value;
    const on = v === true || v === "true";
    aiConsentCache = { at: Date.now(), on };
    return on;
}
// Platform residency region, cached briefly. Routes LLM calls to a region-appropriate model when infra
// has configured one (see REGION_MODELS). "global" (default) is a pass-through.
let regionCache = null;
async function loadResidency(dbh) {
    if (regionCache && Date.now() - regionCache.at < 60_000)
        return regionCache.region;
    const [row] = await (0, db_1.runWithRls)(dbh.pool, { platform: true }, (tx) => tx.select({ value: db_1.schema.appidoSettings.value }).from(db_1.schema.appidoSettings).where((0, drizzle_orm_1.eq)(db_1.schema.appidoSettings.key, "residency")).limit(1));
    const region = typeof row?.value === "string" && row.value ? row.value : "global";
    regionCache = { at: Date.now(), region };
    return region;
}
// Platform PII-redaction policy, cached briefly. Masks customer text before it reaches the LLM.
let piiCache = null;
async function loadPiiMode(dbh) {
    if (piiCache && Date.now() - piiCache.at < 60_000)
        return piiCache.mode;
    const [row] = await (0, db_1.runWithRls)(dbh.pool, { platform: true }, (tx) => tx.select({ value: db_1.schema.appidoSettings.value }).from(db_1.schema.appidoSettings).where((0, drizzle_orm_1.eq)(db_1.schema.appidoSettings.key, "pii_redaction")).limit(1));
    const v = row?.value;
    const mode = v === "off" || v === "mask_at_rest" ? v : "mask_before_llm";
    piiCache = { at: Date.now(), mode };
    return mode;
}
// Platform onboarding script, cached briefly (changes are infrequent; owner edits via the console).
let scriptCache = null;
async function loadOnboardingScript(dbh) {
    if (scriptCache && Date.now() - scriptCache.at < 60_000)
        return scriptCache.rows;
    const rows = await (0, db_1.runWithRls)(dbh.pool, { platform: true }, (tx) => tx
        .select({ key: db_1.schema.appidoScript.key, fa: db_1.schema.appidoScript.questionFa, en: db_1.schema.appidoScript.questionEn })
        .from(db_1.schema.appidoScript)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.appidoScript.active, true), (0, drizzle_orm_1.eq)(db_1.schema.appidoScript.enabled, true)))
        .orderBy((0, drizzle_orm_1.asc)(db_1.schema.appidoScript.sortOrder)));
    scriptCache = { at: Date.now(), rows: rows.map((r) => ({ key: r.key, question: r.en || r.fa || r.key })) };
    return scriptCache.rows;
}
function makeAiReplyProcessor(dbh, pub, client, cipher, pay, log) {
    return async (job) => {
        if (!client || !cipher)
            return { ok: true, skipped: true }; // AI gateway not configured
        const { channelId, tenantId, customerId } = job.data;
        const channel = await (0, db_1.runWithRls)(dbh.pool, { platform: true }, async (tx) => {
            const [c] = await tx.select().from(db_1.schema.channels).where((0, drizzle_orm_1.eq)(db_1.schema.channels.id, channelId)).limit(1);
            return c ?? null;
        });
        if (!channel || !channel.aiEnabled || !channel.botTokenEnc)
            return { ok: true, skipped: true };
        const customer = await (0, db_1.runWithRls)(dbh.pool, { platform: false, tenantId }, async (tx) => {
            const [c] = await tx.select().from(db_1.schema.customers).where((0, drizzle_orm_1.eq)(db_1.schema.customers.id, customerId)).limit(1);
            return c ?? null;
        });
        if (!customer || !customer.aiManaged || !customer.tgUserId)
            return { ok: true, skipped: true };
        const [tenant] = await (0, db_1.runWithRls)(dbh.pool, { platform: false, tenantId }, (tx) => tx
            .select({ name: db_1.schema.tenants.name, budgetCents: db_1.schema.tenants.aiBudgetCents })
            .from(db_1.schema.tenants)
            .where((0, drizzle_orm_1.eq)(db_1.schema.tenants.id, tenantId))
            .limit(1));
        const spent = await (0, ai_1.monthToDateCostMicroUsd)(dbh.pool, tenantId);
        if (spent >= (tenant?.budgetCents ?? 0) * 10_000) {
            log.warn({ tenantId }, "ai budget reached; skipping reply");
            return { ok: true, skipped: true };
        }
        const rows = await (0, db_1.runWithRls)(dbh.pool, { platform: false, tenantId }, (tx) => tx
            .select({ direction: db_1.schema.messages.direction, body: db_1.schema.messages.body })
            .from(db_1.schema.messages)
            .where((0, drizzle_orm_1.eq)(db_1.schema.messages.customerId, customerId))
            .orderBy((0, drizzle_orm_1.asc)(db_1.schema.messages.at))
            .limit(20));
        const piiMode = await loadPiiMode(dbh);
        const history = rows.map((m) => ({
            role: m.direction === "in" ? "user" : "assistant",
            content: (0, ai_1.redactForLlm)(m.body, piiMode),
        }));
        if (history.length === 0)
            return { ok: true, skipped: true };
        const telegram = new telegram_1.TelegramApi(cipher.decrypt(channel.botTokenEnc));
        let onboarding = [];
        if (channel.onboardingEnabled) {
            const answered = new Set(Object.keys((customer.profile ?? {})));
            onboarding = (await loadOnboardingScript(dbh)).filter((q) => !answered.has(q.key));
        }
        let requireAiConsent = false;
        if (await loadAiConsentRequired(dbh)) {
            const [cc] = await (0, db_1.runWithRls)(dbh.pool, { platform: false, tenantId }, (tx) => tx
                .select({ granted: db_1.schema.customerConsent.granted })
                .from(db_1.schema.customerConsent)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customerConsent.customerId, customerId), (0, drizzle_orm_1.eq)(db_1.schema.customerConsent.purpose, "ai")))
                .limit(1));
            requireAiConsent = !(cc?.granted === true);
        }
        const system = (0, ai_1.buildSystemPrompt)({
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
        const route = (0, ai_1.replyRoute)({ intent: customer.intent, isVip: customer.isVip });
        const region = await loadResidency(dbh);
        const replyModel = (0, ai_1.routeModel)(route.tier === "smart" ? (0, ai_1.resolveModel)(channel.aiModel) : (0, ai_1.modelForTier)("fast"), region);
        // Best-effort "typing…" so the customer sees the bot is responding (never blocks the reply).
        await telegram.sendChatAction(customer.tgUserId, "typing").catch(() => undefined);
        const result = await (0, ai_1.runAgent)({
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
                    await pub.publish(`rt:${tenantId}`, JSON.stringify({ type: e.type, tenantId, at: new Date().toISOString(), payload: e.payload }));
                },
            },
        });
        const latencyMs = Date.now() - t0;
        await (0, ai_1.recordUsage)(dbh.pool, { tenantId, customerId, model: replyModel, usage: result.usage, requestId: String(job.id ?? ""), task: route.task, tier: route.tier, latencyMs });
        if (result.text.trim()) {
            await telegram.sendMessage(customer.tgUserId, result.text);
            await (0, db_1.runWithRls)(dbh.pool, { platform: false, tenantId }, async (tx) => {
                await tx.insert(db_1.schema.messages).values({ tenantId, channelId, customerId, direction: "out", body: result.text, author: "ai" });
                await tx.insert(db_1.schema.events).values({ tenantId, customerId, type: "message" });
            });
            await pub.publish(`rt:${tenantId}`, JSON.stringify({ type: "message.created", tenantId, at: new Date().toISOString(), payload: { author: "ai" } }));
        }
        log.debug({ tenantId, channelId, steps: result.steps }, "ai reply processed");
        return { ok: true };
    };
}
//# sourceMappingURL=ai-reply.js.map