import { sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { runWithRls, schema } from "@appido/db";

// Owner/platform analytics. Aggregates run under platform RLS (cross-tenant). The two revenue
// streams stay strictly separate: MRR = Appido's own subscription revenue (subscriptions table);
// GMV = platform volume that tenants' customers paid tenants (transactions table).

type Tx = NodePgDatabase<typeof schema>;

async function rows<T>(tx: Tx, q: SQL): Promise<T[]> {
  const res = (await tx.execute(q)) as unknown;
  if (Array.isArray(res)) return res as T[];
  const r = (res as { rows?: unknown[] }).rows;
  return (Array.isArray(r) ? r : []) as T[];
}
const clamp = (n: number | undefined, lo: number, hi: number, dflt: number): number =>
  Math.min(Math.max(Math.floor(Number.isFinite(n as number) ? (n as number) : dflt), lo), hi);

// ---- MRR (Appido subscription revenue) ----
export interface MrrResult {
  mrrCents: number;
  currency: string;
  byPlan: { plan: string; subs: number; cents: number }[];
  statuses: Record<string, number>;
}
export async function mrr(pool: Pool): Promise<MrrResult> {
  return runWithRls(pool, { platform: true }, async (tx) => {
    // each tenant's LATEST subscription, counted once (avoids double-counting renewals)
    const byPlan = await rows<{ plan: string; subs: number; cents: number }>(
      tx,
      sql`SELECT plan, count(*)::int AS subs, coalesce(sum(amount_cents),0)::bigint AS cents
          FROM (SELECT DISTINCT ON (tenant_id) tenant_id, plan, amount_cents, status
                FROM subscriptions ORDER BY tenant_id, period_start DESC) latest
          WHERE status = 'active'
          GROUP BY plan ORDER BY plan`,
    );
    const statusRows = await rows<{ status: string; n: number }>(
      tx,
      sql`SELECT status, count(*)::int AS n
          FROM (SELECT DISTINCT ON (tenant_id) tenant_id, status
                FROM subscriptions ORDER BY tenant_id, period_start DESC) l
          GROUP BY status`,
    );
    const statuses: Record<string, number> = {};
    for (const r of statusRows) statuses[r.status] = Number(r.n);
    const plans = byPlan.map((r) => ({ plan: r.plan, subs: Number(r.subs), cents: Number(r.cents) }));
    return { mrrCents: plans.reduce((s, r) => s + r.cents, 0), currency: "USD", byPlan: plans, statuses };
  });
}

// ---- GMV (platform volume) ----
export interface GmvResult {
  windowDays: number;
  byCurrency: { currency: string; txns: number; cents: number }[];
  series: { day: string; currency: string; cents: number }[];
  topTenants: { tenantId: string; currency: string; cents: number; txns: number }[];
}
export async function gmv(pool: Pool, days?: number): Promise<GmvResult> {
  const windowDays = clamp(days, 1, 365, 30);
  return runWithRls(pool, { platform: true }, async (tx) => {
    const byCurrency = await rows<{ currency: string; txns: number; cents: number }>(
      tx,
      sql`SELECT currency, count(*)::int AS txns, coalesce(sum(amount_cents),0)::bigint AS cents
          FROM transactions WHERE status='ok' AND at >= now() - make_interval(days => ${windowDays})
          GROUP BY currency ORDER BY cents DESC`,
    );
    const series = await rows<{ day: string; currency: string; cents: number }>(
      tx,
      sql`SELECT to_char(date_trunc('day', at), 'YYYY-MM-DD') AS day, currency, sum(amount_cents)::bigint AS cents
          FROM transactions WHERE status='ok' AND at >= now() - make_interval(days => ${windowDays})
          GROUP BY day, currency ORDER BY day`,
    );
    const topTenants = await rows<{ tenantId: string; currency: string; cents: number; txns: number }>(
      tx,
      sql`SELECT tenant_id AS "tenantId", currency, sum(amount_cents)::bigint AS cents, count(*)::int AS txns
          FROM transactions WHERE status='ok' AND at >= now() - make_interval(days => ${windowDays})
          GROUP BY tenant_id, currency ORDER BY cents DESC LIMIT 10`,
    );
    return {
      windowDays,
      byCurrency: byCurrency.map((r) => ({ currency: r.currency, txns: Number(r.txns), cents: Number(r.cents) })),
      series: series.map((r) => ({ day: r.day, currency: r.currency, cents: Number(r.cents) })),
      topTenants: topTenants.map((r) => ({ tenantId: r.tenantId, currency: r.currency, cents: Number(r.cents), txns: Number(r.txns) })),
    };
  });
}

// ---- Funnel (customers → engaged → scored → paid) ----
export interface FunnelResult {
  customers: number;
  engaged: number;
  scored: number;
  paid: number;
  rates: { engagedPct: number; scoredPct: number; paidPct: number; scoredToPaidPct: number };
}
export async function funnel(pool: Pool): Promise<FunnelResult> {
  return runWithRls(pool, { platform: true }, async (tx) => {
    const [r] = await rows<{ customers: number; engaged: number; scored: number; paid: number }>(
      tx,
      sql`WITH ev AS (
            SELECT customer_id, bool_or(type='scored') AS scored, bool_or(type='paid') AS paid
            FROM events WHERE customer_id IS NOT NULL GROUP BY customer_id
          )
          SELECT
            count(c.id)::int AS customers,
            count(ev.customer_id)::int AS engaged,
            count(c.id) FILTER (WHERE c.intent > 0 OR ev.scored)::int AS scored,
            count(c.id) FILTER (WHERE ev.paid)::int AS paid
          FROM customers c LEFT JOIN ev ON ev.customer_id = c.id`,
    );
    const customers = Number(r?.customers ?? 0);
    const engaged = Number(r?.engaged ?? 0);
    const scored = Number(r?.scored ?? 0);
    const paid = Number(r?.paid ?? 0);
    const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
    return { customers, engaged, scored, paid, rates: { engagedPct: pct(engaged, customers), scoredPct: pct(scored, customers), paidPct: pct(paid, customers), scoredToPaidPct: pct(paid, scored) } };
  });
}

// ---- Cohorts (monthly customer acquisition → conversion) ----
export interface CohortRow {
  cohort: string;
  customers: number;
  converted: number;
  conversionRatePct: number;
}
export async function cohorts(pool: Pool, months?: number): Promise<CohortRow[]> {
  const window = clamp(months, 1, 36, 6);
  return runWithRls(pool, { platform: true }, async (tx) => {
    const data = await rows<{ cohort: string; customers: number; converted: number }>(
      tx,
      sql`WITH conv AS (SELECT customer_id FROM events WHERE type='paid' AND customer_id IS NOT NULL GROUP BY customer_id)
          SELECT to_char(date_trunc('month', c.created_at), 'YYYY-MM') AS cohort,
            count(*)::int AS customers,
            count(conv.customer_id)::int AS converted
          FROM customers c LEFT JOIN conv ON conv.customer_id = c.id
          WHERE c.created_at >= date_trunc('month', now()) - make_interval(months => ${window})
          GROUP BY cohort ORDER BY cohort`,
    );
    return data.map((r) => {
      const customers = Number(r.customers);
      const converted = Number(r.converted);
      return { cohort: r.cohort, customers, converted, conversionRatePct: customers > 0 ? Math.round((converted / customers) * 100) : 0 };
    });
  });
}

// ---- Conversion (platform-wide flywheel, by task) ----
export interface ConversionRow {
  task: string;
  total: number;
  converted: number;
  noConversion: number;
  conversionRatePct: number;
}
export async function conversion(pool: Pool): Promise<ConversionRow[]> {
  return runWithRls(pool, { platform: true }, async (tx) => {
    const data = await rows<{ task: string; total: number; converted: number; no_conversion: number }>(
      tx,
      sql`SELECT coalesce(task,'unknown') AS task,
            count(*)::int AS total,
            count(*) FILTER (WHERE outcome='converted')::int AS converted,
            count(*) FILTER (WHERE outcome='no_conversion')::int AS no_conversion
          FROM ai_usage WHERE task IS NOT NULL GROUP BY task ORDER BY total DESC`,
    );
    return data.map((r) => {
      const converted = Number(r.converted);
      const noConversion = Number(r.no_conversion);
      const decided = converted + noConversion;
      return { task: r.task, total: Number(r.total), converted, noConversion, conversionRatePct: decided > 0 ? Math.round((converted / decided) * 100) : 0 };
    });
  });
}

// ---- Overview (headline composite) ----
export interface OverviewResult {
  mrrCents: number;
  activeSubscribers: number;
  gmv30d: { currency: string; cents: number }[];
  customers: number;
  paidCustomers: number;
  aiConversionRatePct: number;
}
export async function overview(pool: Pool): Promise<OverviewResult> {
  const [m, g, f, conv] = await Promise.all([mrr(pool), gmv(pool, 30), funnel(pool), conversion(pool)]);
  const totConverted = conv.reduce((s, r) => s + r.converted, 0);
  const totDecided = conv.reduce((s, r) => s + r.converted + r.noConversion, 0);
  return {
    mrrCents: m.mrrCents,
    activeSubscribers: m.statuses.active ?? 0,
    gmv30d: g.byCurrency.map((c) => ({ currency: c.currency, cents: c.cents })),
    customers: f.customers,
    paidCustomers: f.paid,
    aiConversionRatePct: totDecided > 0 ? Math.round((totConverted / totDecided) * 100) : 0,
  };
}
