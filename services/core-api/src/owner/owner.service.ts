import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { runWithRls, schema, type DbHandle, type RlsContext } from "@appido/db";
import { DB } from "../db/db.module";

const n = (v: unknown): number => Number(v ?? 0);

@Injectable()
export class OwnerService {
  constructor(@Inject(DB) private readonly dbh: DbHandle) {}

  /** Platform-wide overview. Appido MRR vs tenant GMV reported as distinct figures. */
  overview(ctx: RlsContext) {
    return runWithRls(this.dbh.pool, ctx, async (tx) => {
      const [{ tenants }] = await tx.select({ tenants: sql<number>`count(*)::int` }).from(schema.tenants);
      const [{ channels }] = await tx.select({ channels: sql<number>`count(*)::int` }).from(schema.channels);
      const [{ customers }] = await tx.select({ customers: sql<number>`count(*)::int` }).from(schema.customers);
      const [{ activeSubs }] = await tx
        .select({ activeSubs: sql<number>`count(*)::int` })
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.status, "active"));
      const [{ mrrCents }] = await tx
        .select({ mrrCents: sql<number>`coalesce(sum(${schema.subscriptions.amountCents}),0)::bigint` })
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.status, "active"));
      const [{ gmvCents }] = await tx
        .select({ gmvCents: sql<number>`coalesce(sum(${schema.transactions.amountCents}),0)::bigint` })
        .from(schema.transactions)
        .where(eq(schema.transactions.status, "ok"));
      const [{ tokens }] = await tx
        .select({ tokens: sql<number>`coalesce(sum(${schema.aiUsage.tokensIn}) + sum(${schema.aiUsage.tokensOut}),0)::bigint` })
        .from(schema.aiUsage);
      const recent = await tx
        .select({ type: schema.events.type, at: schema.events.at })
        .from(schema.events)
        .orderBy(desc(schema.events.at))
        .limit(10);
      return {
        tenants: n(tenants),
        channels: n(channels),
        customers: n(customers),
        activeSubscriptions: n(activeSubs),
        mrrUsd: n(mrrCents) / 100, // Appido revenue
        gmvUsd: n(gmvCents) / 100, // platform-wide tenant sales
        aiTokens: n(tokens),
        recentActivity: recent,
      };
    });
  }

  /** Real per-tenant operational list for the owner console (platform-scoped). */
  tenants(ctx: RlsContext) {
    return runWithRls(this.dbh.pool, ctx, async (tx) => {
      const res = await tx.execute(sql`
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
      const rows = ((res as { rows?: unknown[] }).rows ?? (res as unknown[])) as Array<Record<string, unknown>>;
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
        createdAt: r.createdAt ? new Date(r.createdAt as string).toISOString() : null,
        lastActivity: r.lastActivity ? new Date(r.lastActivity as string).toISOString() : null,
      }));
    });
  }

  // Recent landing-page signals (public analytics events). Read-only owner view; flags likely leads
  // (events carrying a contact in props, or intent-style names).
  leads(ctx: RlsContext) {
    return runWithRls(this.dbh.pool, ctx, async (tx) => {
      const rows = await tx
        .select({ id: schema.analyticsEvents.id, name: schema.analyticsEvents.name, anonId: schema.analyticsEvents.anonId, props: schema.analyticsEvents.props, at: schema.analyticsEvents.at })
        .from(schema.analyticsEvents)
        .orderBy(desc(schema.analyticsEvents.at))
        .limit(100);
      const LEAD_RE = /lead|demo|contact|signup|sign_up|register|trial|cta/i;
      return rows.map((r) => {
        const props = (r.props ?? {}) as Record<string, unknown>;
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
          at: r.at ? new Date(r.at as unknown as string).toISOString() : null,
        };
      });
    });
  }

  // Appido MRR broken down by plan (active subscriptions). Appido revenue — distinct from tenant GMV.
  mrr(ctx: RlsContext) {
    return runWithRls(this.dbh.pool, ctx, async (tx) => {
      const byPlan = await tx
        .select({
          plan: schema.subscriptions.plan,
          subs: sql<number>`count(*)::int`,
          cents: sql<number>`coalesce(sum(${schema.subscriptions.amountCents}),0)::bigint`,
        })
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.status, "active"))
        .groupBy(schema.subscriptions.plan);
      const rows = byPlan.map((r) => ({ plan: r.plan, subs: Number(r.subs), cents: Number(r.cents) }));
      return { mrrCents: rows.reduce((s, r) => s + r.cents, 0), currency: "USD", byPlan: rows };
    });
  }

  // Tenant GMV (confirmed transactions) by currency + a 30-day daily series. Tenant revenue — NOT Appido MRR.
  gmv(ctx: RlsContext) {
    return runWithRls(this.dbh.pool, ctx, async (tx) => {
      const byCurrency = await tx
        .select({ currency: schema.transactions.currency, cents: sql<number>`coalesce(sum(${schema.transactions.amountCents}),0)::bigint` })
        .from(schema.transactions)
        .where(eq(schema.transactions.status, "ok"))
        .groupBy(schema.transactions.currency);
      const since = new Date(Date.now() - 30 * 86_400_000);
      const series = await tx
        .select({
          day: sql<string>`to_char(date_trunc('day', ${schema.transactions.createdAt}), 'YYYY-MM-DD')`,
          currency: schema.transactions.currency,
          cents: sql<number>`coalesce(sum(${schema.transactions.amountCents}),0)::bigint`,
        })
        .from(schema.transactions)
        .where(and(eq(schema.transactions.status, "ok"), gte(schema.transactions.createdAt, since)))
        .groupBy(sql`date_trunc('day', ${schema.transactions.createdAt})`, schema.transactions.currency)
        .orderBy(sql`date_trunc('day', ${schema.transactions.createdAt})`);
      return {
        byCurrency: byCurrency.map((r) => ({ currency: r.currency, cents: Number(r.cents) })),
        series: series.map((r) => ({ day: r.day, currency: r.currency, cents: Number(r.cents) })),
      };
    });
  }

  // Platform acquisition funnel: reached → engaged → scored → paid (real counts; rates derived).
  funnel(ctx: RlsContext) {
    return runWithRls(this.dbh.pool, ctx, async (tx) => {
      const one = async (where?: ReturnType<typeof sql>) => {
        const q = tx.select({ n: sql<number>`count(*)::int` }).from(schema.customers);
        const [row] = await (where ? q.where(where) : q);
        return Number(row?.n ?? 0);
      };
      const customers = await one();
      const engaged = await one(sql`${schema.customers.intent} > 0`);
      const scored = await one(sql`${schema.customers.tag} <> 'cold'`);
      const paid = await one(sql`${schema.customers.ltvCents} > 0`);
      const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
      return {
        customers,
        engaged,
        scored,
        paid,
        rates: { engagedPct: pct(engaged, customers), scoredPct: pct(scored, customers), paidPct: pct(paid, customers), scoredToPaidPct: pct(paid, scored) },
      };
    });
  }
