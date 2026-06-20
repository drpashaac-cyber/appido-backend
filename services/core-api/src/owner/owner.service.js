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
exports.OwnerService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@appido/db");
const db_module_1 = require("../db/db.module");
const n = (v) => Number(v ?? 0);
let OwnerService = class OwnerService {
    dbh;
    constructor(dbh) {
        this.dbh = dbh;
    }
    /** Platform-wide overview. Appido MRR vs tenant GMV reported as distinct figures. */
    overview(ctx) {
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, async (tx) => {
            const [{ tenants }] = await tx.select({ tenants: (0, drizzle_orm_1.sql) `count(*)::int` }).from(db_1.schema.tenants);
            const [{ channels }] = await tx.select({ channels: (0, drizzle_orm_1.sql) `count(*)::int` }).from(db_1.schema.channels);
            const [{ customers }] = await tx.select({ customers: (0, drizzle_orm_1.sql) `count(*)::int` }).from(db_1.schema.customers);
            const [{ activeSubs }] = await tx
                .select({ activeSubs: (0, drizzle_orm_1.sql) `count(*)::int` })
                .from(db_1.schema.subscriptions)
                .where((0, drizzle_orm_1.eq)(db_1.schema.subscriptions.status, "active"));
            const [{ mrrCents }] = await tx
                .select({ mrrCents: (0, drizzle_orm_1.sql) `coalesce(sum(${db_1.schema.subscriptions.amountCents}),0)::bigint` })
                .from(db_1.schema.subscriptions)
                .where((0, drizzle_orm_1.eq)(db_1.schema.subscriptions.status, "active"));
            const [{ gmvCents }] = await tx
                .select({ gmvCents: (0, drizzle_orm_1.sql) `coalesce(sum(${db_1.schema.transactions.amountCents}),0)::bigint` })
                .from(db_1.schema.transactions)
                .where((0, drizzle_orm_1.eq)(db_1.schema.transactions.status, "ok"));
            const [{ tokens }] = await tx
                .select({ tokens: (0, drizzle_orm_1.sql) `coalesce(sum(${db_1.schema.aiUsage.tokensIn}) + sum(${db_1.schema.aiUsage.tokensOut}),0)::bigint` })
                .from(db_1.schema.aiUsage);
            const recent = await tx
                .select({ type: db_1.schema.events.type, at: db_1.schema.events.at })
                .from(db_1.schema.events)
                .orderBy((0, drizzle_orm_1.desc)(db_1.schema.events.at))
                .limit(10);
            return {
                tenants: n(tenants),
                channels: n(channels),
                customers: n(customers),
                activeSubscriptions: n(activeSubs),
                mrrUsd: n(mrrCents) / 100,
                gmvUsd: n(gmvCents) / 100,
                aiTokens: n(tokens),
                recentActivity: recent,
            };
        });
    }
    /** Real per-tenant operational list for the owner console (platform-scoped). */
    tenants(ctx) {
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, async (tx) => {
            const res = await tx.execute((0, drizzle_orm_1.sql) `
        SELECT
          t.id, t.name, t.country, t.created_at AS "createdAt",
          (SELECT username FROM channels ch WHERE ch.tenant_id = t.id ORDER BY ch.created_at ASC LIMIT 1) AS handle,
          (SELECT count(*)::int FROM customers c WHERE c.tenant_id = t.id) AS customers,
          (SELECT coalesce(sum(members), 0)::int FROM channels ch WHERE ch.tenant_id = t.id) AS members,
          s.plan AS plan,
          coalesce(s.amount_cents, 0)::int AS "mrrCents",
          (SELECT coalesce(sum(amount_cents), 0)::bigint FROM transactions tr WHERE tr.tenant_id = t.id AND tr.status = 'ok') AS "gmvCents",
          (SELECT ai_model FROM channels ch WHERE ch.tenant_id = t.id ORDER BY ch.created_at ASC LIMIT 1) AS "aiModel",
          (SELECT ai_enabled FROM channels ch WHERE ch.tenant_id = t.id ORDER BY ch.created_at ASC LIMIT 1) AS "aiEnabled",
          (SELECT max(at) FROM events ev WHERE ev.tenant_id = t.id) AS "lastActivity"
        FROM tenants t
        LEFT JOIN LATERAL (
          SELECT plan, amount_cents
          FROM subscriptions su
          WHERE su.tenant_id = t.id AND su.status = 'active'
          ORDER BY su.created_at DESC
          LIMIT 1
        ) s ON true
        ORDER BY t.created_at DESC
        LIMIT 200
      `);
            const rows = (res.rows ?? res);
            return rows.map((r) => ({
                id: String(r.id),
                name: String(r.name ?? ""),
                handle: r.handle ? String(r.handle) : null,
                country: r.country ? String(r.country) : null,
                plan: r.plan ? String(r.plan) : "free",
                mrrCents: Number(r.mrrCents ?? 0),
                gmvCents: Number(r.gmvCents ?? 0),
                customers: Number(r.customers ?? 0),
                members: Number(r.members ?? 0),
                aiModel: r.aiModel ? String(r.aiModel) : null,
                aiEnabled: r.aiEnabled === null || r.aiEnabled === undefined ? null : Boolean(r.aiEnabled),
                createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
                lastActivity: r.lastActivity ? new Date(r.lastActivity).toISOString() : null,
            }));
        });
    }
    // Recent landing-page signals (public analytics events). Read-only owner view; flags likely leads
    // (events carrying a contact in props, or intent-style names).
    leads(ctx) {
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, async (tx) => {
            const rows = await tx
                .select({ id: db_1.schema.analyticsEvents.id, name: db_1.schema.analyticsEvents.name, anonId: db_1.schema.analyticsEvents.anonId, props: db_1.schema.analyticsEvents.props, at: db_1.schema.analyticsEvents.at })
                .from(db_1.schema.analyticsEvents)
                .orderBy((0, drizzle_orm_1.desc)(db_1.schema.analyticsEvents.at))
                .limit(100);
            const LEAD_RE = /lead|demo|contact|signup|sign_up|register|trial|cta/i;
            return rows.map((r) => {
                const props = (r.props ?? {});
                const email = typeof props.email === "string" ? props.email : null;
                const phone = typeof props.phone === "string" ? props.phone : null;
                return {
                    id: r.id,
                    name: r.name,
                    anonId: r.anonId,
                    email,
                    phone,
                    isLead: !!email || !!phone || LEAD_RE.test(r.name),
                    props,
                    at: r.at ? new Date(r.at).toISOString() : null,
                };
            });
        });
    }
    // Appido MRR broken down by plan (active subscriptions). Appido revenue — distinct from tenant GMV.
    mrr(ctx) {
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, async (tx) => {
            const byPlan = await tx
                .select({
                plan: db_1.schema.subscriptions.plan,
                subs: (0, drizzle_orm_1.sql) `count(*)::int`,
                cents: (0, drizzle_orm_1.sql) `coalesce(sum(${db_1.schema.subscriptions.amountCents}),0)::bigint`,
            })
                .from(db_1.schema.subscriptions)
                .where((0, drizzle_orm_1.eq)(db_1.schema.subscriptions.status, "active"))
                .groupBy(db_1.schema.subscriptions.plan);
            const rows = byPlan.map((r) => ({ plan: r.plan, subs: Number(r.subs), cents: Number(r.cents) }));
            return { mrrCents: rows.reduce((s, r) => s + r.cents, 0), currency: "USD", byPlan: rows };
        });
    }
    // Tenant GMV (confirmed transactions) by currency + a 30-day daily series. Tenant revenue — NOT Appido MRR.
    gmv(ctx) {
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, async (tx) => {
            const byCurrency = await tx
                .select({ currency: db_1.schema.transactions.currency, cents: (0, drizzle_orm_1.sql) `coalesce(sum(${db_1.schema.transactions.amountCents}),0)::bigint` })
                .from(db_1.schema.transactions)
                .where((0, drizzle_orm_1.eq)(db_1.schema.transactions.status, "ok"))
                .groupBy(db_1.schema.transactions.currency);
            const since = new Date(Date.now() - 30 * 86_400_000);
            const series = await tx
                .select({
                day: (0, drizzle_orm_1.sql) `to_char(date_trunc('day', ${db_1.schema.transactions.createdAt}), 'YYYY-MM-DD')`,
                currency: db_1.schema.transactions.currency,
                cents: (0, drizzle_orm_1.sql) `coalesce(sum(${db_1.schema.transactions.amountCents}),0)::bigint`,
            })
                .from(db_1.schema.transactions)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.transactions.status, "ok"), (0, drizzle_orm_1.gte)(db_1.schema.transactions.createdAt, since)))
                .groupBy((0, drizzle_orm_1.sql) `date_trunc('day', ${db_1.schema.transactions.createdAt})`, db_1.schema.transactions.currency)
                .orderBy((0, drizzle_orm_1.sql) `date_trunc('day', ${db_1.schema.transactions.createdAt})`);
            return {
                byCurrency: byCurrency.map((r) => ({ currency: r.currency, cents: Number(r.cents) })),
                series: series.map((r) => ({ day: r.day, currency: r.currency, cents: Number(r.cents) })),
            };
        });
    }
    // Platform acquisition funnel: reached → engaged → scored → paid (real counts; rates derived).
    funnel(ctx) {
        return (0, db_1.runWithRls)(this.dbh.pool, ctx, async (tx) => {
            const one = async (where) => {
                const q = tx.select({ n: (0, drizzle_orm_1.sql) `count(*)::int` }).from(db_1.schema.customers);
                const [row] = await (where ? q.where(where) : q);
                return Number(row?.n ?? 0);
            };
            const customers = await one();
            const engaged = await one((0, drizzle_orm_1.sql) `${db_1.schema.customers.intent} > 0`);
            const scored = await one((0, drizzle_orm_1.sql) `${db_1.schema.customers.tag} <> 'cold'`);
            const paid = await one((0, drizzle_orm_1.sql) `${db_1.schema.customers.ltvCents} > 0`);
            const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
            return {
                customers,
                engaged,
                scored,
                paid,
                rates: { engagedPct: pct(engaged, customers), scoredPct: pct(scored, customers), paidPct: pct(paid, customers), scoredToPaidPct: pct(paid, scored) },
            };
        });
    }
};
exports.OwnerService = OwnerService;
exports.OwnerService = OwnerService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(db_module_1.DB)),
    __metadata("design:paramtypes", [Object])
], OwnerService);
//# sourceMappingURL=owner.service.js.map