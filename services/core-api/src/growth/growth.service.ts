import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Queue } from "bullmq";
import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { runWithRls, schema, type DbHandle, type RlsContext } from "@appido/db";
import { DB } from "../db/db.module";
import { GROWTH_QUEUE } from "../queue/queue.module";
import { AiService } from "../ai/ai.service";

type Criteria = Record<string, unknown>;
type Tx = NodePgDatabase<typeof schema>;
const N = (v: unknown): number => Number(v ?? 0);

async function rows<T>(tx: Tx, q: SQL): Promise<T[]> {
  const res = (await tx.execute(q)) as unknown;
  if (Array.isArray(res)) return res as T[];
  const r = (res as { rows?: unknown[] }).rows;
  return (Array.isArray(r) ? r : []) as T[];
}

const SEG_TAGS = ["hot", "warm", "cold", "vip"] as const;
// Mirror of the worker's audience rules (services/workers .../growth.ts) — kept in sync deliberately.
function criteriaConditions(criteria: Criteria): SQL[] {
  const c: SQL[] = [];
  if (typeof criteria.minScore === "number") c.push(gte(schema.customers.intent, criteria.minScore));
  if (typeof criteria.maxScore === "number") c.push(lte(schema.customers.intent, criteria.maxScore));
  if (typeof criteria.minLtvCents === "number") c.push(gte(schema.customers.ltvCents, criteria.minLtvCents));
  if (typeof criteria.maxLtvCents === "number") c.push(lte(schema.customers.ltvCents, criteria.maxLtvCents));
  if (criteria.isVip === true) c.push(eq(schema.customers.isVip, true));
  if (typeof criteria.tag === "string" && (SEG_TAGS as readonly string[]).includes(criteria.tag)) {
    c.push(eq(schema.customers.tag, criteria.tag as (typeof SEG_TAGS)[number]));
  }
  return c;
}

function describeAudience(criteria: Criteria): string {
  const p: string[] = [];
  if (criteria.tag) p.push(`${String(criteria.tag)} leads`);
  if (criteria.minScore != null) p.push(`purchase intent >= ${Number(criteria.minScore)}`);
  if (criteria.maxScore != null) p.push(`purchase intent <= ${Number(criteria.maxScore)}`);
  if (criteria.isVip === true) p.push("VIP customers");
  if (criteria.maxLtvCents === 0) p.push("who have not purchased yet");
  if (Array.isArray(criteria.tags) && criteria.tags.length) p.push(`tagged ${criteria.tags.map(String).join("/")}`);
  return p.length ? p.join(", ") : "your Telegram audience";
}

@Injectable()
export class GrowthService {
  constructor(
    @Inject(DB) private readonly dbh: DbHandle,
    @Inject(GROWTH_QUEUE) private readonly growthQueue: Queue,
    private readonly ai: AiService,
  ) {}

  // --- lead scoring (enqueue a fast-tier batch job) ---
  async enqueueScore(ctx: RlsContext, body: { limit?: number; activeWithinDays?: number }) {
    await this.growthQueue.add("score-leads", {
      tenantId: ctx.tenantId,
      limit: Math.min(body.limit ?? 200, 1000),
      activeWithinDays: body.activeWithinDays,
    });
    return { accepted: true };
  }

  // --- lead finding: customers ranked by intent (highest-value leads first) ---
  listLeads(ctx: RlsContext, q: { limit?: number; minScore?: number }) {
    const limit = Math.min(q.limit ?? 50, 100);
    return runWithRls(this.dbh.pool, ctx, (tx) =>
      tx
        .select({
          id: schema.customers.id,
          name: schema.customers.name,
          handle: schema.customers.handle,
          tag: schema.customers.tag,
          intent: schema.customers.intent,
          ltvCents: schema.customers.ltvCents,
          tags: schema.customers.tags,
          isVip: schema.customers.isVip,
          segment: schema.customers.segment,
        })
        .from(schema.customers)
        .where(q.minScore != null ? gte(schema.customers.intent, q.minScore) : undefined)
        .orderBy(desc(schema.customers.intent))
        .limit(limit),
    );
  }

  // --- segments (reusable targeting criteria) ---
  listSegments(ctx: RlsContext) {
    return runWithRls(this.dbh.pool, ctx, async (tx) => {
      const segs = await tx.select().from(schema.segments).orderBy(desc(schema.segments.createdAt));
      const out: Array<(typeof segs)[number] & { count: number }> = [];
      for (const s of segs) {
        const conds = criteriaConditions((s.criteria as Criteria) ?? {});
        const [r] = await tx
          .select({ c: sql<number>`count(*)::int` })
          .from(schema.customers)
          .where(conds.length ? and(...conds) : undefined);
        out.push({ ...s, count: N(r?.c) });
      }
      return out;
    });
  }
  async createSegment(ctx: RlsContext, body: { name: string; criteria: Criteria }) {
    const [row] = await runWithRls(this.dbh.pool, ctx, (tx) =>
      tx.insert(schema.segments).values({ tenantId: ctx.tenantId!, name: body.name, criteria: body.criteria ?? {} }).returning({ id: schema.segments.id }),
    );
    return { id: row.id };
  }
  async deleteSegment(ctx: RlsContext, id: string) {
    await runWithRls(this.dbh.pool, ctx, (tx) => tx.delete(schema.segments).where(eq(schema.segments.id, id)));
    return { ok: true };
  }

  // --- campaigns ---
  listCampaigns(ctx: RlsContext) {
    return runWithRls(this.dbh.pool, ctx, (tx) =>
      rows<{ id: string; name: string; status: string; goal: string | null; createdAt: string; sent: number; converted: number; total: number }>(
        tx,
        sql`SELECT c.id, c.name, c.status, c.goal, c.created_at AS "createdAt",
              coalesce(s.sent,0)::int AS sent, coalesce(s.converted,0)::int AS converted, coalesce(s.total,0)::int AS total
            FROM campaigns c
            LEFT JOIN (
              SELECT campaign_id,
                count(*) FILTER (WHERE status='sent') AS sent,
                count(*) FILTER (WHERE converted_at IS NOT NULL) AS converted,
                count(*) AS total
              FROM campaign_sends GROUP BY campaign_id
            ) s ON s.campaign_id = c.id
            ORDER BY c.created_at DESC LIMIT 100`,
      ),
    );
  }
  async createCampaign(
    ctx: RlsContext,
    body: { name: string; channelId?: string; goal?: string; bodyText?: string; segmentId?: string; criteria?: Criteria },
  ) {
    const [row] = await runWithRls(this.dbh.pool, ctx, (tx) =>
      tx
        .insert(schema.campaigns)
        .values({
          tenantId: ctx.tenantId!,
          name: body.name,
          channelId: body.channelId ?? null,
          goal: body.goal ?? null,
          body: body.bodyText ?? null,
          segmentId: body.segmentId ?? null,
          criteria: body.criteria ?? null,
          status: "draft",
        })
        .returning({ id: schema.campaigns.id }),
    );
    return { id: row.id };
  }
  private async loadCampaign(ctx: RlsContext, id: string) {
    const [c] = await runWithRls(this.dbh.pool, ctx, (tx) => tx.select().from(schema.campaigns).where(eq(schema.campaigns.id, id)).limit(1));
    if (!c) throw new NotFoundException("campaign_not_found");
    return c;
  }
  getCampaign(ctx: RlsContext, id: string) {
    return this.loadCampaign(ctx, id);
  }

  // generate copy (smart tier), store into the campaign body
  async generateCopy(ctx: RlsContext, id: string, opts: { tone?: string; language?: string; product?: string }) {
    const c = await this.loadCampaign(ctx, id);
    let criteria: Criteria = (c.criteria as Criteria | null) ?? {};
    if (c.segmentId) {
      const [seg] = await runWithRls(this.dbh.pool, ctx, (tx) =>
        tx.select({ criteria: schema.segments.criteria }).from(schema.segments).where(eq(schema.segments.id, c.segmentId!)).limit(1),
      );
      if (seg) criteria = (seg.criteria as Criteria) ?? {};
    }
    const r = await this.ai.campaignCopy(ctx, {
      goal: c.goal ?? c.name,
      audience: describeAudience(criteria),
      product: opts.product,
      tone: opts.tone,
      language: opts.language,
    });
    if (r.budgetExceeded) return { budgetExceeded: true, body: "" };
    await runWithRls(this.dbh.pool, ctx, (tx) => tx.update(schema.campaigns).set({ body: r.body }).where(eq(schema.campaigns.id, id)));
    return { budgetExceeded: false, body: r.body };
  }

  // enqueue the broadcast send
  async send(ctx: RlsContext, id: string) {
    const c = await this.loadCampaign(ctx, id);
    if (!c.body) throw new BadRequestException("campaign_has_no_body");
    if (c.status === "sending" || c.status === "sent") throw new BadRequestException(`campaign_already_${c.status}`);
    await runWithRls(this.dbh.pool, ctx, (tx) => tx.update(schema.campaigns).set({ status: "scheduled" }).where(eq(schema.campaigns.id, id)));
    await this.growthQueue.add("run-campaign", { tenantId: ctx.tenantId, campaignId: id });
    return { accepted: true };
  }
}
