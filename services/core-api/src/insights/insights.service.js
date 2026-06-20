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
exports.InsightsService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@appido/db");
const db_module_1 = require("../db/db.module");
const n = (v) => Number(v ?? 0);
async function rows(tx, q) {
    const res = (await tx.execute(q));
    if (Array.isArray(res))
        return res;
    const r = res.rows;
    return (Array.isArray(r) ? r : []);
}
const QUALIFIED_INTENT = 60; // intent (0..100) >= this counts as a qualified lead/customer
let InsightsService = class InsightsService {
    dbh;
    constructor(dbh) {
        this.dbh = dbh;
    }
    /** Headline KPIs for the dashboard overview. */
    summary(ctx) {
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, async (tx) => {
            const [cur] = await rows(tx, (0, drizzle_orm_1.sql) `SELECT coalesce(sum(amount_cents),0)::bigint AS cents FROM transactions
            WHERE status='ok' AND at >= now() - make_interval(days => 90)`);
            const [prev] = await rows(tx, (0, drizzle_orm_1.sql) `SELECT coalesce(sum(amount_cents),0)::bigint AS cents FROM transactions
            WHERE status='ok' AND at >= now() - make_interval(days => 180) AND at < now() - make_interval(days => 90)`);
            const [tot] = await rows(tx, (0, drizzle_orm_1.sql) `SELECT count(*)::int AS c FROM customers`);
            const [ql] = await rows(tx, (0, drizzle_orm_1.sql) `SELECT count(*)::int AS c FROM customers WHERE intent >= ${QUALIFIED_INTENT}`);
            const [paid] = await rows(tx, (0, drizzle_orm_1.sql) `SELECT count(DISTINCT customer_id)::int AS c FROM transactions WHERE status='ok' AND customer_id IS NOT NULL`);
            const [subs] = await rows(tx, (0, drizzle_orm_1.sql) `SELECT count(*)::int AS c FROM customers WHERE is_vip = true AND (vip_until IS NULL OR vip_until > now())`);
            const curUsd = n(cur?.cents) / 100;
            const prevUsd = n(prev?.cents) / 100;
            const customers = n(tot?.c);
            return {
                revenueUsd90d: curUsd,
                revenueDeltaPct: prevUsd > 0 ? Math.round(((curUsd - prevUsd) / prevUsd) * 1000) / 10 : null,
                customers,
                qualifiedLeads: n(ql?.c),
                conversionPct: customers > 0 ? Math.round((n(paid?.c) / customers) * 1000) / 10 : 0,
                activeSubscribers: n(subs?.c),
                churnPct: null,
            };
        });
    }
    /** Weekly OK-revenue (USD) for the last `weeks` weeks, oldest → newest. */
    revenue(ctx, weeks = 12) {
        const w = Math.min(Math.max(Math.floor(Number.isFinite(weeks) ? weeks : 12), 1), 52);
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, async (tx) => {
            const series = await rows(tx, (0, drizzle_orm_1.sql) `SELECT to_char(date_trunc('week', at), 'YYYY-MM-DD') AS week, sum(amount_cents)::bigint AS cents
            FROM transactions WHERE status='ok' AND at >= date_trunc('week', now()) - make_interval(weeks => ${w})
            GROUP BY week ORDER BY week`);
            return { weeks: w, series: series.map((r) => ({ week: r.week, usd: n(r.cents) / 100 })) };
        });
    }
    /** Acquisition funnel: reached → engaged (AI-managed) → qualified (intent≥threshold or warm/hot/vip) → paid. */
    funnel(ctx) {
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, async (tx) => {
            const [r] = await rows(tx, (0, drizzle_orm_1.sql) `SELECT
              count(*)::int AS reached,
              count(*) FILTER (WHERE ai_managed = true)::int AS engaged,
              count(*) FILTER (WHERE intent >= ${QUALIFIED_INTENT} OR tag IN ('warm','hot','vip'))::int AS qualified,
              count(*) FILTER (WHERE id IN (SELECT DISTINCT customer_id FROM transactions WHERE status='ok' AND customer_id IS NOT NULL))::int AS paid
            FROM customers`);
            const reached = n(r?.reached);
            const pct = (v) => (reached > 0 ? Math.round((v / reached) * 1000) / 10 : 0);
            const stages = [
                { stage: "reached", count: reached, pct: 100 },
                { stage: "engaged", count: n(r?.engaged), pct: pct(n(r?.engaged)) },
                { stage: "qualified", count: n(r?.qualified), pct: pct(n(r?.qualified)) },
                { stage: "paid", count: n(r?.paid), pct: pct(n(r?.paid)) },
            ];
            return { stages };
        });
    }
};
exports.InsightsService = InsightsService;
exports.InsightsService = InsightsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(db_module_1.DB)),
    __metadata("design:paramtypes", [Object])
], InsightsService);
//# sourceMappingURL=insights.service.js.map