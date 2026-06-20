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
exports.GrowthService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@appido/db");
const db_module_1 = require("../db/db.module");
const queue_module_1 = require("../queue/queue.module");
const ai_service_1 = require("../ai/ai.service");
const N = (v) => Number(v ?? 0);
async function rows(tx, q) {
    const res = (await tx.execute(q));
    if (Array.isArray(res))
        return res;
    const r = res.rows;
    return (Array.isArray(r) ? r : []);
}
const SEG_TAGS = ["hot", "warm", "cold", "vip"];
// Mirror of the worker's audience rules (services/workers .../growth.ts) — kept in sync deliberately.
function criteriaConditions(criteria) {
    const c = [];
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
    if (typeof criteria.tag === "string" && SEG_TAGS.includes(criteria.tag)) {
        c.push((0, drizzle_orm_1.eq)(db_1.schema.customers.tag, criteria.tag));
    }
    return c;
}
function describeAudience(criteria) {
    const p = [];
    if (criteria.tag)
        p.push(`${String(criteria.tag)} leads`);
    if (criteria.minScore != null)
        p.push(`purchase intent >= ${Number(criteria.minScore)}`);
    if (criteria.maxScore != null)
        p.push(`purchase intent <= ${Number(criteria.maxScore)}`);
    if (criteria.isVip === true)
        p.push("VIP customers");
    if (criteria.maxLtvCents === 0)
        p.push("who have not purchased yet");
    if (Array.isArray(criteria.tags) && criteria.tags.length)
        p.push(`tagged ${criteria.tags.map(String).join("/")}`);
    return p.length ? p.join(", ") : "your Telegram audience";
}
let GrowthService = class GrowthService {
    dbh;
    growthQueue;
    ai;
    constructor(dbh, growthQueue, ai) {
        this.dbh = dbh;
        this.growthQueue = growthQueue;
        this.ai = ai;
    }
    // --- lead scoring (enqueue a fast-tier batch job) ---
    async enqueueScore(ctx, body) {
        await this.growthQueue.add("score-leads", {
            tenantId: ctx.tenantId,
            limit: Math.min(body.limit ?? 200, 1000),
            activeWithinDays: body.activeWithinDays,
        });
        return { accepted: true };
    }
    // --- lead finding: customers ranked by intent (highest-value leads first) ---
    listLeads(ctx, q) {
        const limit = Math.min(q.limit ?? 50, 100);
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, (tx) => tx
            .select({
            id: db_1.schema.customers.id,
            name: db_1.schema.customers.name,
            handle: db_1.schema.customers.handle,
            tag: db_1.schema.customers.tag,
            intent: db_1.schema.customers.intent,
            ltvCents: db_1.schema.customers.ltvCents,
            tags: db_1.schema.customers.tags,
            isVip: db_1.schema.customers.isVip,
            segment: db_1.schema.customers.segment,
        })
            .from(db_1.schema.customers)
            .where(q.minScore != null ? (0, drizzle_orm_1.gte)(db_1.schema.customers.intent, q.minScore) : undefined)
            .orderBy((0, drizzle_orm_1.desc)(db_1.schema.customers.intent))
            .limit(limit));
    }
    // --- segments (reusable targeting criteria) ---
    listSegments(ctx) {
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, async (tx) => {
            const segs = await tx.select().from(db_1.schema.segments).orderBy((0, drizzle_orm_1.desc)(db_1.schema.segments.createdAt));
            const out = [];
            for (const s of segs) {
                const conds = criteriaConditions(s.criteria ?? {});
                const [r] = await tx
                    .select({ c: (0, drizzle_orm_1.sql) `count(*)::int` })
                    .from(db_1.schema.customers)
                    .where(conds.length ? (0, drizzle_orm_1.and)(...conds) : undefined);
                out.push({ ...s, count: N(r?.c) });
            }
            return out;
        });
    }
    async createSegment(ctx, body) {
        const [row] = await (0, db_1.runWithRls)(this.dbh.pool, ctx, (tx) => tx.insert(db_1.schema.segments).values({ tenantId: ctx.tenantId, name: body.name, criteria: body.criteria ?? {} }).returning({ id: db_1.schema.segments.id }));
        return { id: row.id };
    }
    async deleteSegment(ctx, id) {
        await (0, db_1.runWithRls)(this.dbh.pool, ctx, (tx) => tx.delete(db_1.schema.segments).where((0, drizzle_orm_1.eq)(db_1.schema.segments.id, id)));
        return { ok: true };
    }
    // --- campaigns ---
    listCampaigns(ctx) {
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, (tx) => rows(tx, (0, drizzle_orm_1.sql) `SELECT c.id, c.name, c.status, c.goal, c.created_at AS "createdAt",
              coalesce(s.sent,0)::int AS sent, coalesce(s.converted,0)::int AS converted, coalesce(s.total,0)::int AS total
            FROM campaigns c
            LEFT JOIN (
              SELECT campaign_id,
                count(*) FILTER (WHERE status='sent') AS sent,
                count(*) FILTER (WHERE converted_at IS NOT NULL) AS converted,
                count(*) AS total
              FROM campaign_sends GROUP BY campaign_id
            ) s ON s.campaign_id = c.id
            ORDER BY c.created_at DESC LIMIT 100`));
    }
    async createCampaign(ctx, body) {
        const [row] = await (0, db_1.runWithRls)(this.dbh.pool, ctx, (tx) => tx
            .insert(db_1.schema.campaigns)
            .values({
            tenantId: ctx.tenantId,
            name: body.name,
            channelId: body.channelId ?? null,
            goal: body.goal ?? null,
            body: body.bodyText ?? null,
            segmentId: body.segmentId ?? null,
            criteria: body.criteria ?? null,
            status: "draft",
        })
            .returning({ id: db_1.schema.campaigns.id }));
        return { id: row.id };
    }
    async loadCampaign(ctx, id) {
        const [c] = await (0, db_1.runWithRls)(this.dbh.pool, ctx, (tx) => tx.select().from(db_1.schema.campaigns).where((0, drizzle_orm_1.eq)(db_1.schema.campaigns.id, id)).limit(1));
        if (!c)
            throw new common_1.NotFoundException("campaign_not_found");
        return c;
    }
    getCampaign(ctx, id) {
        return this.loadCampaign(ctx, id);
    }
    // generate copy (smart tier), store into the campaign body
    async generateCopy(ctx, id, opts) {
        const c = await this.loadCampaign(ctx, id);
        let criteria = c.criteria ?? {};
        if (c.segmentId) {
            const [seg] = await (0, db_1.runWithRls)(this.dbh.pool, ctx, (tx) => tx.select({ criteria: db_1.schema.segments.criteria }).from(db_1.schema.segments).where((0, drizzle_orm_1.eq)(db_1.schema.segments.id, c.segmentId)).limit(1));
            if (seg)
                criteria = seg.criteria ?? {};
        }
        const r = await this.ai.campaignCopy(ctx, {
            goal: c.goal ?? c.name,
            audience: describeAudience(criteria),
            product: opts.product,
            tone: opts.tone,
            language: opts.language,
        });
        if (r.budgetExceeded)
            return { budgetExceeded: true, body: "" };
        await (0, db_1.runWithRls)(this.dbh.pool, ctx, (tx) => tx.update(db_1.schema.campaigns).set({ body: r.body }).where((0, drizzle_orm_1.eq)(db_1.schema.campaigns.id, id)));
        return { budgetExceeded: false, body: r.body };
    }
    // enqueue the broadcast send
    async send(ctx, id) {
        const c = await this.loadCampaign(ctx, id);
        if (!c.body)
            throw new common_1.BadRequestException("campaign_has_no_body");
        if (c.status === "sending" || c.status === "sent")
            throw new common_1.BadRequestException(`campaign_already_${c.status}`);
        await (0, db_1.runWithRls)(this.dbh.pool, ctx, (tx) => tx.update(db_1.schema.campaigns).set({ status: "scheduled" }).where((0, drizzle_orm_1.eq)(db_1.schema.campaigns.id, id)));
        await this.growthQueue.add("run-campaign", { tenantId: ctx.tenantId, campaignId: id });
        return { accepted: true };
    }
};
exports.GrowthService = GrowthService;
exports.GrowthService = GrowthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(db_module_1.DB)),
    __param(1, (0, common_1.Inject)(queue_module_1.GROWTH_QUEUE)),
    __metadata("design:paramtypes", [Object, bullmq_1.Queue,
        ai_service_1.AiService])
], GrowthService);
//# sourceMappingURL=growth.service.js.map