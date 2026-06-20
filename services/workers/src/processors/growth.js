"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeGrowthProcessor = makeGrowthProcessor;
const drizzle_orm_1 = require("drizzle-orm");
const ai_1 = require("@appido/ai");
const db_1 = require("@appido/db");
const telegram_1 = require("@appido/telegram");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// customer-column criteria → drizzle conditions (always require a Telegram user id).
function criteriaToConditions(criteria) {
    const c = [(0, drizzle_orm_1.isNotNull)(db_1.schema.customers.tgUserId)];
    if (typeof criteria.minScore === "number")
        c.push((0, drizzle_orm_1.gte)(db_1.schema.customers.intent, criteria.minScore));
    if (typeof criteria.maxScore === "number")
        c.push((0, drizzle_orm_1.lte)(db_1.schema.customers.intent, criteria.maxScore));
    if (typeof criteria.minLtvCents === "number")
        c.push((0, drizzle_orm_1.gte)(db_1.schema.customers.ltvCents, criteria.minLtvCents));
    if (typeof criteria.maxLtvCents === "number")
        c.push((0, drizzle_orm_1.lte)(db_1.schema.customers.ltvCents, criteria.maxLtvCents));
    if (criteria.isVip === true)
        c.push((0, drizzle_orm_1.eq)(db_1.schema.customers.isVip, true));
    const tags = ["hot", "warm", "cold", "vip"];
    if (typeof criteria.tag === "string" && tags.includes(criteria.tag)) {
        c.push((0, drizzle_orm_1.eq)(db_1.schema.customers.tag, criteria.tag));
    }
    return c;
}
// Marketing opt-in policy, cached briefly. When ON, campaigns only reach consented customers.
let optinCache = null;
async function loadRequireOptin(dbh) {
    if (optinCache && Date.now() - optinCache.at < 60_000)
        return optinCache.on;
    const [row] = await (0, db_1.runWithRls)(dbh.pool, { platform: true }, (tx) => tx.select({ value: db_1.schema.appidoSettings.value }).from(db_1.schema.appidoSettings).where((0, drizzle_orm_1.eq)(db_1.schema.appidoSettings.key, "require_optin")).limit(1));
    const v = row?.value;
    const on = v === true || v === "true";
    optinCache = { at: Date.now(), on };
    return on;
}
async function loadMarketingConsent(dbh, tenantId) {
    const rows = await (0, db_1.runWithRls)(dbh.pool, { platform: false, tenantId }, (tx) => tx
        .select({ customerId: db_1.schema.customerConsent.customerId })
        .from(db_1.schema.customerConsent)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customerConsent.purpose, "marketing"), (0, drizzle_orm_1.eq)(db_1.schema.customerConsent.granted, true))));
    return new Set(rows.map((r) => r.customerId));
}
function makeGrowthProcessor(dbh, pub, client, cipher, log) {
    const publish = (tenantId, type, payload) => pub.publish(`rt:${tenantId}`, JSON.stringify({ type, tenantId, at: new Date().toISOString(), payload }));
    // ---- batch lead scoring on the cheap `fast` tier ----
    async function scoreLeads(data) {
        if (!client)
            return { ok: true, scored: 0 };
        const [tenant] = await (0, db_1.runWithRls)(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) => tx.select({ budgetCents: db_1.schema.tenants.aiBudgetCents }).from(db_1.schema.tenants).where((0, drizzle_orm_1.eq)(db_1.schema.tenants.id, data.tenantId)).limit(1));
        const spent = await (0, ai_1.monthToDateCostMicroUsd)(dbh.pool, data.tenantId);
        if (spent >= (tenant?.budgetCents ?? 0) * 10_000) {
            log.warn({ tenantId: data.tenantId }, "score-leads: ai budget reached; skipping");
            return { ok: true, scored: 0 };
        }
        const limit = Math.min(data.limit ?? 200, 1000);
        const customers = await (0, db_1.runWithRls)(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) => tx
            .select({
            id: db_1.schema.customers.id,
            name: db_1.schema.customers.name,
            handle: db_1.schema.customers.handle,
            tag: db_1.schema.customers.tag,
            intent: db_1.schema.customers.intent,
            ltvCents: db_1.schema.customers.ltvCents,
            points: db_1.schema.customers.points,
            tags: db_1.schema.customers.tags,
            isVip: db_1.schema.customers.isVip,
            locale: db_1.schema.customers.locale,
        })
            .from(db_1.schema.customers)
            .orderBy((0, drizzle_orm_1.desc)(db_1.schema.customers.updatedAt))
            .limit(limit));
        let scored = 0;
        for (const c of customers) {
            const ev = await (0, db_1.runWithRls)(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) => tx
                .select({ type: db_1.schema.events.type, amountCents: db_1.schema.events.amountCents })
                .from(db_1.schema.events)
                .where((0, drizzle_orm_1.eq)(db_1.schema.events.customerId, c.id))
                .orderBy((0, drizzle_orm_1.desc)(db_1.schema.events.at))
                .limit(8));
            const profile = JSON.stringify({
                name: c.name,
                handle: c.handle,
                currentTag: c.tag,
                currentIntent: c.intent,
                ltvUsd: (c.ltvCents ?? 0) / 100,
                points: c.points,
                tags: c.tags ?? [],
                isVip: c.isVip,
                locale: c.locale,
                recentEvents: ev.map((e) => ({ type: e.type, usd: e.amountCents != null ? e.amountCents / 100 : undefined })),
            });
            const t0 = Date.now();
            const r = await (0, ai_1.scoreLead)(client, { profile }).catch(() => null);
            const latencyMs = Date.now() - t0;
            if (!r?.result)
                continue;
            const s = r.result;
            await (0, db_1.runWithRls)(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) => tx.update(db_1.schema.customers).set({ intent: s.score, tag: s.tier, tags: s.tags, updatedAt: new Date() }).where((0, drizzle_orm_1.eq)(db_1.schema.customers.id, c.id)));
            if (r.usage) {
                await (0, ai_1.recordUsage)(dbh.pool, { tenantId: data.tenantId, customerId: c.id, model: r.model, usage: r.usage, task: "score_lead", tier: "fast", latencyMs });
            }
            await (0, db_1.runWithRls)(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) => tx.insert(db_1.schema.events).values({ tenantId: data.tenantId, customerId: c.id, type: "scored", meta: { score: s.score, tier: s.tier } }));
            scored++;
        }
        await publish(data.tenantId, "leads.scored", { scored });
        log.info({ tenantId: data.tenantId, scored }, "score-leads done");
        return { ok: true, scored };
    }
    // ---- broadcast a campaign to a segment via the tenant's bot ----
    async function runCampaign(data) {
        if (!cipher) {
            log.warn("run-campaign: secrets unconfigured; skipping");
            return { ok: true, sent: 0, failed: 0 };
        }
        const [c] = await (0, db_1.runWithRls)(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) => tx.select().from(db_1.schema.campaigns).where((0, drizzle_orm_1.eq)(db_1.schema.campaigns.id, data.campaignId)).limit(1));
        if (!c || !c.body || c.status === "sent" || c.status === "sending")
            return { ok: true, sent: 0, failed: 0 };
        const body = c.body;
        const channel = await (0, db_1.runWithRls)(dbh.pool, { platform: true }, async (tx) => {
            if (c.channelId) {
                const [ch] = await tx.select().from(db_1.schema.channels).where((0, drizzle_orm_1.eq)(db_1.schema.channels.id, c.channelId)).limit(1);
                return ch ?? null;
            }
            const [ch] = await tx.select().from(db_1.schema.channels).where((0, drizzle_orm_1.eq)(db_1.schema.channels.tenantId, data.tenantId)).limit(1);
            return ch ?? null;
        });
        if (!channel?.botTokenEnc) {
            await (0, db_1.runWithRls)(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) => tx.update(db_1.schema.campaigns).set({ status: "failed", stats: { error: "no_bot_configured" } }).where((0, drizzle_orm_1.eq)(db_1.schema.campaigns.id, data.campaignId)));
            return { ok: false, sent: 0, failed: 0 };
        }
        const botTokenEnc = channel.botTokenEnc;
        let criteria = c.criteria ?? {};
        if (c.segmentId) {
            const [seg] = await (0, db_1.runWithRls)(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) => tx.select({ criteria: db_1.schema.segments.criteria }).from(db_1.schema.segments).where((0, drizzle_orm_1.eq)(db_1.schema.segments.id, c.segmentId)).limit(1));
            if (seg)
                criteria = seg.criteria ?? {};
        }
        const recipients = await (0, db_1.runWithRls)(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) => tx.select({ id: db_1.schema.customers.id, tgUserId: db_1.schema.customers.tgUserId }).from(db_1.schema.customers).where((0, drizzle_orm_1.and)(...criteriaToConditions(criteria))).limit(5000));
        await (0, db_1.runWithRls)(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) => tx.update(db_1.schema.campaigns).set({ status: "sending" }).where((0, drizzle_orm_1.eq)(db_1.schema.campaigns.id, data.campaignId)));
        const requireOptin = await loadRequireOptin(dbh);
        const consentSet = requireOptin ? await loadMarketingConsent(dbh, data.tenantId) : null;
        const tg = new telegram_1.TelegramApi(cipher.decrypt(botTokenEnc));
        let sent = 0;
        let failed = 0;
        let skipped = 0;
        for (const r of recipients) {
            if (r.tgUserId == null)
                continue;
            if (consentSet && !consentSet.has(r.id)) {
                skipped++;
                await (0, db_1.runWithRls)(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) => tx.insert(db_1.schema.campaignSends).values({ tenantId: data.tenantId, campaignId: data.campaignId, customerId: r.id, status: "skipped_no_consent" }));
                continue;
            }
            try {
                await tg.sendMessage(r.tgUserId, body);
                sent++;
                await (0, db_1.runWithRls)(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) => tx.insert(db_1.schema.campaignSends).values({ tenantId: data.tenantId, campaignId: data.campaignId, customerId: r.id, status: "sent" }));
                await (0, db_1.runWithRls)(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) => tx.insert(db_1.schema.events).values({ tenantId: data.tenantId, customerId: r.id, type: "campaign_sent", meta: { campaignId: data.campaignId } }));
            }
            catch {
                await sleep(1000); // transient (e.g. 429) — one retry
                try {
                    await tg.sendMessage(r.tgUserId, body);
                    sent++;
                    await (0, db_1.runWithRls)(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) => tx.insert(db_1.schema.campaignSends).values({ tenantId: data.tenantId, campaignId: data.campaignId, customerId: r.id, status: "sent" }));
                }
                catch (err2) {
                    failed++;
                    await (0, db_1.runWithRls)(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) => tx.insert(db_1.schema.campaignSends).values({ tenantId: data.tenantId, campaignId: data.campaignId, customerId: r.id, status: "failed", error: String(err2.message).slice(0, 200) }));
                }
            }
            await sleep(50); // ~20 msg/s — within Telegram broadcast limits
        }
        await (0, db_1.runWithRls)(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) => tx
            .update(db_1.schema.campaigns)
            .set({ status: "sent", stats: { recipients: recipients.length, sent, failed, skipped, finishedAt: new Date().toISOString() } })
            .where((0, drizzle_orm_1.eq)(db_1.schema.campaigns.id, data.campaignId)));
        await publish(data.tenantId, "campaign.sent", { campaignId: data.campaignId, sent, failed });
        log.info({ tenantId: data.tenantId, campaignId: data.campaignId, sent, failed }, "run-campaign done");
        return { ok: true, sent, failed };
    }
    // ---- flywheel: attribute real outcomes onto the AI ledger (idempotent, nightly) ----
    async function attribute() {
        const r = await (0, ai_1.attributeOutcomes)(dbh.pool, { lookbackDays: 3, windowDays: 14 });
        log.info(r, "flywheel attribution done");
        return r;
    }
    // ---- eval-runner: score the model against owner-curated golden cases ----
    async function evaluate(data) {
        if (!client)
            return { ok: false, reason: "ai_unconfigured" };
        const r = await (0, ai_1.runEval)(dbh.pool, client, { task: data.task, model: data.model });
        log.info(r, "eval run done");
        return r;
    }
    // ---- rotate all secrets to the current primary key (key rotation sweep) ----
    async function rotateSecrets() {
        if (!cipher)
            return { reEncrypted: 0 };
        let n = 0;
        const creds = await (0, db_1.runWithRls)(dbh.pool, { platform: true }, (tx) => tx.select({ id: db_1.schema.paymentCredentials.id, v: db_1.schema.paymentCredentials.secretEnc }).from(db_1.schema.paymentCredentials).where((0, drizzle_orm_1.isNotNull)(db_1.schema.paymentCredentials.secretEnc)));
        for (const r of creds) {
            const next = r.v ? cipher.reEncrypt(r.v) : null;
            if (next) {
                await (0, db_1.runWithRls)(dbh.pool, { platform: true }, (tx) => tx.update(db_1.schema.paymentCredentials).set({ secretEnc: next }).where((0, drizzle_orm_1.eq)(db_1.schema.paymentCredentials.id, r.id)));
                n++;
            }
        }
        const chans = await (0, db_1.runWithRls)(dbh.pool, { platform: true }, (tx) => tx.select({ id: db_1.schema.channels.id, v: db_1.schema.channels.botTokenEnc }).from(db_1.schema.channels).where((0, drizzle_orm_1.isNotNull)(db_1.schema.channels.botTokenEnc)));
        for (const r of chans) {
            const next = r.v ? cipher.reEncrypt(r.v) : null;
            if (next) {
                await (0, db_1.runWithRls)(dbh.pool, { platform: true }, (tx) => tx.update(db_1.schema.channels).set({ botTokenEnc: next }).where((0, drizzle_orm_1.eq)(db_1.schema.channels.id, r.id)));
                n++;
            }
        }
        const tens = await (0, db_1.runWithRls)(dbh.pool, { platform: true }, (tx) => tx.select({ id: db_1.schema.tenants.id, v: db_1.schema.tenants.aiVirtualKeyEnc }).from(db_1.schema.tenants).where((0, drizzle_orm_1.isNotNull)(db_1.schema.tenants.aiVirtualKeyEnc)));
        for (const r of tens) {
            const next = r.v ? cipher.reEncrypt(r.v) : null;
            if (next) {
                await (0, db_1.runWithRls)(dbh.pool, { platform: true }, (tx) => tx.update(db_1.schema.tenants).set({ aiVirtualKeyEnc: next }).where((0, drizzle_orm_1.eq)(db_1.schema.tenants.id, r.id)));
                n++;
            }
        }
        log.info({ reEncrypted: n }, "secret rotation sweep done");
        return { reEncrypted: n };
    }
    return async (job) => {
        if (job.name === "score-leads")
            return scoreLeads(job.data);
        if (job.name === "run-campaign")
            return runCampaign(job.data);
        if (job.name === "attribute")
            return attribute();
        if (job.name === "run-eval")
            return evaluate(job.data);
        if (job.name === "rotate-secrets")
            return rotateSecrets();
        log.warn({ name: job.name }, "growth: unknown job type");
        return { ok: false };
    };
}
//# sourceMappingURL=growth.js.map