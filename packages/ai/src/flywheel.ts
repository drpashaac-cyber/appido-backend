import { and, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type { Pool } from "pg";
import { runWithRls, schema } from "@appido/db";

export interface AttributionStats {
  paidEvents: number;
  converted: number; // ai_usage rows marked converted
  campaignSendsConverted: number;
  negativesLabeled: number;
}

const ATTRIBUTABLE_TASKS = ["chat", "score_lead"];

// Idempotent batch: attribute real outcomes (paid) back onto ai_usage + campaign_sends, and
// label aged interactions that never converted as negatives. This is the labeled dataset that
// powers eval-gated improvement (AI-STRATEGY.md). Safe to re-run; outcomes are monotonic.
export async function attributeOutcomes(
  pool: Pool,
  opts?: { lookbackDays?: number; windowDays?: number },
): Promise<AttributionStats> {
  const lookback = opts?.lookbackDays ?? 3;
  const windowDays = opts?.windowDays ?? 14;
  const now = Date.now();
  const lookbackTs = new Date(now - lookback * 86_400_000);

  const paid = await runWithRls(pool, { platform: true }, (tx) =>
    tx
      .select({ tenantId: schema.events.tenantId, customerId: schema.events.customerId, at: schema.events.at })
      .from(schema.events)
      .where(and(eq(schema.events.type, "paid"), gte(schema.events.at, lookbackTs)))
      .limit(5000),
  );

  let converted = 0;
  let campaignSendsConverted = 0;
  for (const p of paid) {
    if (!p.customerId) continue;
    const customerId = p.customerId;
    const since = new Date(new Date(p.at).getTime() - windowDays * 86_400_000);
    const r1 = await runWithRls(pool, { platform: false, tenantId: p.tenantId }, (tx) =>
      tx
        .update(schema.aiUsage)
        .set({ outcome: "converted" })
        .where(and(eq(schema.aiUsage.customerId, customerId), gte(schema.aiUsage.at, since), isNull(schema.aiUsage.outcome)))
        .returning({ id: schema.aiUsage.id }),
    );
    converted += r1.length;
    const r2 = await runWithRls(pool, { platform: false, tenantId: p.tenantId }, (tx) =>
      tx
        .update(schema.campaignSends)
        .set({ convertedAt: new Date() })
        .where(and(eq(schema.campaignSends.customerId, customerId), gte(schema.campaignSends.at, since), isNull(schema.campaignSends.convertedAt)))
        .returning({ id: schema.campaignSends.id }),
    );
    campaignSendsConverted += r2.length;
  }

  // negatives: window fully elapsed, conversion-relevant task, still no outcome
  const negCutoff = new Date(now - windowDays * 86_400_000);
  const neg = await runWithRls(pool, { platform: true }, (tx) =>
    tx
      .update(schema.aiUsage)
      .set({ outcome: "no_conversion" })
      .where(and(isNull(schema.aiUsage.outcome), isNotNull(schema.aiUsage.customerId), lt(schema.aiUsage.at, negCutoff), inArray(schema.aiUsage.task, ATTRIBUTABLE_TASKS)))
      .returning({ id: schema.aiUsage.id }),
  );

  return { paidEvents: paid.length, converted, campaignSendsConverted, negativesLabeled: neg.length };
}

export interface TaskOutcomeStat {
  task: string;
  total: number;
  converted: number;
  noConversion: number;
  conversionRatePct: number; // converted / (converted + no_conversion)
}

// Per-task conversion stats for a tenant ("is the AI actually converting?").
export async function flywheelStats(pool: Pool, tenantId: string): Promise<TaskOutcomeStat[]> {
  const rows = await runWithRls(pool, { platform: false, tenantId }, (tx) =>
    tx
      .select({
        task: schema.aiUsage.task,
        total: sql<number>`count(*)::int`,
        converted: sql<number>`count(*) filter (where ${schema.aiUsage.outcome} = 'converted')::int`,
        noConversion: sql<number>`count(*) filter (where ${schema.aiUsage.outcome} = 'no_conversion')::int`,
      })
      .from(schema.aiUsage)
      .where(isNotNull(schema.aiUsage.task))
      .groupBy(schema.aiUsage.task),
  );
  return rows.map((r) => {
    const total = Number(r.total);
    const converted = Number(r.converted);
    const noConversion = Number(r.noConversion);
    const decided = converted + noConversion;
    return { task: r.task ?? "unknown", total, converted, noConversion, conversionRatePct: decided > 0 ? Math.round((converted / decided) * 100) : 0 };
  });
}
