import { Inject, Injectable } from "@nestjs/common";
import { sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { runWithRls, schema, type DbHandle, type RlsContext } from "@appido/db";
import { DB } from "../db/db.module";

// Tenant-scoped insights for the business-owner DASHBOARD. Every query runs under the caller's
// RLS context, so it returns ONLY that tenant's own customers/transactions — never cross-tenant.
// This is distinct from /v1/owner/analytics/* (platform-wide, owner only).

type Tx = NodePgDatabase<typeof schema>;
const n = (v: unknown): number => Number(v ?? 0);

async function rows<T>(tx: Tx, q: SQL): Promise<T[]> {
  const res = (await tx.execute(q)) as unknown;
  if (Array.isArray(res)) return res as T[];
  const r = (res as { rows?: unknown[] }).rows;
  return (Array.isArray(r) ? r : []) as T[];
}

const QUALIFIED_INTENT = 60; // intent (0..100) >= this counts as a qualified lead/customer

export interface InsightsSummary {
  revenueUsd90d: number;
  revenueDeltaPct: number | null; // vs the prior 90 days; null when there is no prior-period data
  customers: number;
  qualifiedLeads: number;
  conversionPct: number; // distinct paying customers / total customers
  activeSubscribers: number; // the tenant's OWN active VIP subscribers (not Appido's subscription)
  churnPct: number | null; // not computed yet (needs historical subscriber states) — honest null
}
export interface FunnelStage {
  stage: "reached" | "engaged" | "qualified" | "paid";
  count: number;
  pct: number;
}

@Injectable()
export class InsightsService {
  constructor(@Inject(DB) private readonly dbh: DbHandle) {}

  /** Headline KPIs for the dashboard overview. */
  summary(ctx: RlsContext): Promise<InsightsSummary> {
    return runWithRls(this.dbh.pool, ctx, async (tx) => {
      const [cur] = await rows<{ cents: number }>(
        tx,
        sql`SELECT coalesce(sum(amount_cents),0)::bigint AS cents FROM transactions
            WHERE status='ok' AND at >= now() - make_interval(days => 90)`,
      );
      const [prev] = await rows<{ cents: number }>(
        tx,
        sql`SELECT coalesce(sum(amount_cents),0)::bigint AS cents FROM transactions
            WHERE status='ok' AND at >= now() - make_interval(days => 180) AND at < now() - make_interval(days => 90)`,
      );
      const [tot] = await rows<{ c: number }>(tx, sql`SELECT count(*)::int AS c FROM customers`);
      const [ql] = await rows<{ c: number }>(
        tx,
        sql`SELECT count(*)::int AS c FROM customers WHERE intent >= ${QUALIFIED_INTENT}`,
      );
      const [paid] = await rows<{ c: number }>(
        tx,
        sql`SELECT count(DISTINCT customer_id)::int AS c FROM transactions WHERE status='ok' AND customer_id IS NOT NULL`,
      );
      const [subs] = await rows<{ c: number }>(
        tx,
        sql`SELECT count(*)::int AS c FROM customers WHERE is_vip = true AND (vip_until IS NULL OR vip_until > now())`,
      );
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
  revenue(ctx: RlsContext, weeks = 12): Promise<{ weeks: number; series: { week: string; usd: number }[] }> {
    const w = Math.min(Math.max(Math.floor(Number.isFinite(weeks) ? weeks : 12), 1), 52);
    return runWithRls(this.dbh.pool, ctx, async (tx) => {
      const series = await rows<{ week: string; cents: number }>(
        tx,
        sql`SELECT to_char(date_trunc('week', at), 'YYYY-MM-DD') AS week, sum(amount_cents)::bigint AS cents
            FROM transactions WHERE status='ok' AND at >= date_trunc('week', now()) - make_interval(weeks => ${w})
            GROUP BY week ORDER BY week`,
      );
      return { weeks: w, series: series.map((r) => ({ week: r.week, usd: n(r.cents) / 100 })) };
    });
  }

  /** Acquisition funnel: reached → engaged (AI-managed) → qualified (intent≥threshold or warm/hot/vip) → paid. */
  funnel(ctx: RlsContext): Promise<{ stages: FunnelStage[] }> {
    return runWithRls(this.dbh.pool, ctx, async (tx) => {
      const [r] = await rows<{ reached: number; engaged: number; qualified: number; paid: number }>(
        tx,
        sql`SELECT
              count(*)::int AS reached,
              count(*) FILTER (WHERE ai_managed = true)::int AS engaged,
              count(*) FILTER (WHERE intent >= ${QUALIFIED_INTENT} OR tag IN ('warm','hot','vip'))::int AS qualified,
              count(*) FILTER (WHERE id IN (SELECT DISTINCT customer_id FROM transactions WHERE status='ok' AND customer_id IS NOT NULL))::int AS paid
            FROM customers`,
      );
      const reached = n(r?.reached);
      const pct = (v: number): number => (reached > 0 ? Math.round((v / reached) * 1000) / 10 : 0);
      const stages: FunnelStage[] = [
        { stage: "reached", count: reached, pct: 100 },
        { stage: "engaged", count: n(r?.engaged), pct: pct(n(r?.engaged)) },
        { stage: "qualified", count: n(r?.qualified), pct: pct(n(r?.qualified)) },
        { stage: "paid", count: n(r?.paid), pct: pct(n(r?.paid)) },
      ];
      return { stages };
    });
  }
}
