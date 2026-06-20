import { gte, sql } from "drizzle-orm";
import type { Pool } from "pg";
import { runWithRls, schema } from "@appido/db";
import { estimateCostMicroUsd, resolveModel } from "./models";
import type { ChatUsage } from "./types";

/** Persist one AI call's token usage + estimated cost to the per-tenant ledger. */
export async function recordUsage(
  pool: Pool,
  input: {
    tenantId: string;
    customerId?: string | null;
    model: string;
    usage: ChatUsage;
    requestId?: string;
    task?: string;
    tier?: string;
    latencyMs?: number;
    outcome?: string;
  },
): Promise<{ costMicroUsd: number }> {
  const model = resolveModel(input.model);
  const costMicroUsd = estimateCostMicroUsd(model, input.usage.prompt_tokens, input.usage.completion_tokens);
  await runWithRls(pool, { platform: false, tenantId: input.tenantId }, (tx) =>
    tx.insert(schema.aiUsage).values({
      tenantId: input.tenantId,
      customerId: input.customerId ?? null,
      model,
      tokensIn: input.usage.prompt_tokens,
      tokensOut: input.usage.completion_tokens,
      costMicroUsd,
      requestId: input.requestId,
      task: input.task,
      tier: input.tier,
      latencyMs: input.latencyMs,
      outcome: input.outcome,
    }),
  );
  return { costMicroUsd };
}

/** Month-to-date AI spend (micro-USD) for budget enforcement. */
export async function monthToDateCostMicroUsd(pool: Pool, tenantId: string): Promise<number> {
  const since = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const rows = await runWithRls(pool, { platform: false, tenantId }, (tx) =>
    tx
      .select({ total: sql<number>`coalesce(sum(${schema.aiUsage.costMicroUsd}),0)::bigint` })
      .from(schema.aiUsage)
      .where(gte(schema.aiUsage.at, since)),
  );
  return Number(rows[0]?.total ?? 0);
}
