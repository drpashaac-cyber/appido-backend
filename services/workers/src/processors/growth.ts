import type { Job } from "bullmq";
import type { Redis } from "ioredis";
import type { Logger } from "pino";
import { and, desc, eq, gte, isNotNull, lte, type SQL } from "drizzle-orm";
import { attributeOutcomes, monthToDateCostMicroUsd, recordUsage, runEval, scoreLead, type LeadScore, type LiteLlmClient } from "@appido/ai";
import { runWithRls, schema, type DbHandle } from "@appido/db";
import type { SecretCipher } from "@appido/crypto";
import { TelegramApi } from "@appido/telegram";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface ScoreJob {
  tenantId: string;
  limit?: number;
  activeWithinDays?: number;
}
interface CampaignJob {
  tenantId: string;
  campaignId: string;
}
interface EvalJob {
  task: string;
  model?: string;
}

// customer-column criteria → drizzle conditions (always require a Telegram user id).
function criteriaToConditions(criteria: Record<string, unknown>): SQL[] {
  const c: SQL[] = [isNotNull(schema.customers.tgUserId)];
  if (typeof criteria.minScore === "number") c.push(gte(schema.customers.intent, criteria.minScore));
  if (typeof criteria.maxScore === "number") c.push(lte(schema.customers.intent, criteria.maxScore));
  if (typeof criteria.minLtvCents === "number") c.push(gte(schema.customers.ltvCents, criteria.minLtvCents));
  if (typeof criteria.maxLtvCents === "number") c.push(lte(schema.customers.ltvCents, criteria.maxLtvCents));
  if (criteria.isVip === true) c.push(eq(schema.customers.isVip, true));
  const tags = ["hot", "warm", "cold", "vip"] as const;
  if (typeof criteria.tag === "string" && (tags as readonly string[]).includes(criteria.tag)) {
    c.push(eq(schema.customers.tag, criteria.tag as (typeof tags)[number]));
  }
  return c;
}

// Marketing opt-in policy, cached briefly. When ON, campaigns only reach consented customers.
let optinCache: { at: number; on: boolean } | null = null;
async function loadRequireOptin(dbh: DbHandle): Promise<boolean> {
  if (optinCache && Date.now() - optinCache.at < 60_000) return optinCache.on;
  const [row] = await runWithRls(dbh.pool, { platform: true }, (tx) =>
    tx.select({ value: schema.appidoSettings.value }).from(schema.appidoSettings).where(eq(schema.appidoSettings.key, "require_optin")).limit(1),
  );
  const v = row?.value as unknown;
  const on = v === true || v === "true";
  optinCache = { at: Date.now(), on };
  return on;
}
async function loadMarketingConsent(dbh: DbHandle, tenantId: string): Promise<Set<string>> {
  const rows = await runWithRls(dbh.pool, { platform: false, tenantId }, (tx) =>
    tx
      .select({ customerId: schema.customerConsent.customerId })
      .from(schema.customerConsent)
      .where(and(eq(schema.customerConsent.purpose, "marketing"), eq(schema.customerConsent.granted, true))),
  );
  return new Set(rows.map((r) => r.customerId));
}

export function makeGrowthProcessor(
  dbh: DbHandle,
  pub: Redis,
  client: LiteLlmClient | null,
  cipher: SecretCipher | null,
  log: Logger,
) {
  const publish = (tenantId: string, type: string, payload: unknown) =>
    pub.publish(`rt:${tenantId}`, JSON.stringify({ type, tenantId, at: new Date().toISOString(), payload }));

  // ---- batch lead scoring on the cheap `fast` tier ----
  async function scoreLeads(data: ScoreJob): Promise<{ ok: boolean; scored: number }> {
    if (!client) return { ok: true, scored: 0 };
    const [tenant] = await runWithRls(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) =>
      tx.select({ budgetCents: schema.tenants.aiBudgetCents }).from(schema.tenants).where(eq(schema.tenants.id, data.tenantId)).limit(1),
    );
    const spent = await monthToDateCostMicroUsd(dbh.pool, data.tenantId);
    if (spent >= (tenant?.budgetCents ?? 0) * 10_000) {
      log.warn({ tenantId: data.tenantId }, "score-leads: ai budget reached; skipping");
      return { ok: true, scored: 0 };
    }

    const limit = Math.min(data.limit ?? 200, 1000);
    const customers = await runWithRls(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) =>
      tx
        .select({
          id: schema.customers.id,
          name: schema.customers.name,
          handle: schema.customers.handle,
          tag: schema.customers.tag,
          intent: schema.customers.intent,
          ltvCents: schema.customers.ltvCents,
          points: schema.customers.points,
          tags: schema.customers.tags,
          isVip: schema.customers.isVip,
          locale: schema.customers.locale,
        })
        .from(schema.customers)
        .orderBy(desc(schema.customers.updatedAt))
        .limit(limit),
    );

    let scored = 0;
    for (const c of customers) {
      const ev = await runWithRls(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) =>
        tx
          .select({ type: schema.events.type, amountCents: schema.events.amountCents })
          .from(schema.events)
          .where(eq(schema.events.customerId, c.id))
          .orderBy(desc(schema.events.at))
          .limit(8),
      );
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
      const r = await scoreLead(client, { profile }).catch(() => null);
      const latencyMs = Date.now() - t0;
      if (!r?.result) continue;
      const s: LeadScore = r.result;
      await runWithRls(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) =>
        tx.update(schema.customers).set({ intent: s.score, tag: s.tier, tags: s.tags, updatedAt: new Date() }).where(eq(schema.customers.id, c.id)),
      );
      if (r.usage) {
        await recordUsage(dbh.pool, { tenantId: data.tenantId, customerId: c.id, model: r.model, usage: r.usage, task: "score_lead", tier: "fast", latencyMs });
      }
      await runWithRls(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) =>
        tx.insert(schema.events).values({ tenantId: data.tenantId, customerId: c.id, type: "scored", meta: { score: s.score, tier: s.tier } }),
      );
      scored++;
    }
    await publish(data.tenantId, "leads.scored", { scored });
    log.info({ tenantId: data.tenantId, scored }, "score-leads done");
    return { ok: true, scored };
  }

  // ---- broadcast a campaign to a segment via the tenant's bot ----
  async function runCampaign(data: CampaignJob): Promise<{ ok: boolean; sent: number; failed: number }> {
    if (!cipher) {
      log.warn("run-campaign: secrets unconfigured; skipping");
      return { ok: true, sent: 0, failed: 0 };
    }
    const [c] = await runWithRls(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) =>
      tx.select().from(schema.campaigns).where(eq(schema.campaigns.id, data.campaignId)).limit(1),
    );
    if (!c || !c.body || c.status === "sent" || c.status === "sending") return { ok: true, sent: 0, failed: 0 };
    const body = c.body;

    const channel = await runWithRls(dbh.pool, { platform: true }, async (tx) => {
      if (c.channelId) {
        const [ch] = await tx.select().from(schema.channels).where(eq(schema.channels.id, c.channelId)).limit(1);
        return ch ?? null;
      }
      const [ch] = await tx.select().from(schema.channels).where(eq(schema.channels.tenantId, data.tenantId)).limit(1);
      return ch ?? null;
    });
    if (!channel?.botTokenEnc) {
      await runWithRls(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) =>
        tx.update(schema.campaigns).set({ status: "failed", stats: { error: "no_bot_configured" } }).where(eq(schema.campaigns.id, data.campaignId)),
      );
      return { ok: false, sent: 0, failed: 0 };
    }
    const botTokenEnc = channel.botTokenEnc;

    let criteria: Record<string, unknown> = (c.criteria as Record<string, unknown> | null) ?? {};
    if (c.segmentId) {
      const [seg] = await runWithRls(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) =>
        tx.select({ criteria: schema.segments.criteria }).from(schema.segments).where(eq(schema.segments.id, c.segmentId)).limit(1),
      );
      if (seg) criteria = (seg.criteria as Record<string, unknown>) ?? {};
    }
    const recipients = await runWithRls(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) =>
      tx.select({ id: schema.customers.id, tgUserId: schema.customers.tgUserId }).from(schema.customers).where(and(...criteriaToConditions(criteria))).limit(5000),
    );

    await runWithRls(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) =>
      tx.update(schema.campaigns).set({ status: "sending" }).where(eq(schema.campaigns.id, data.campaignId)),
    );

    const requireOptin = await loadRequireOptin(dbh);
    const consentSet = requireOptin ? await loadMarketingConsent(dbh, data.tenantId) : null;
    const tg = new TelegramApi(cipher.decrypt(botTokenEnc));
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const r of recipients) {
      if (r.tgUserId == null) continue;
      if (consentSet && !consentSet.has(r.id)) {
        skipped++;
        await runWithRls(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) =>
          tx.insert(schema.campaignSends).values({ tenantId: data.tenantId, campaignId: data.campaignId, customerId: r.id, status: "skipped_no_consent" }),
        );
        continue;
      }
      try {
        await tg.sendMessage(r.tgUserId, body);
        sent++;
        await runWithRls(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) =>
          tx.insert(schema.campaignSends).values({ tenantId: data.tenantId, campaignId: data.campaignId, customerId: r.id, status: "sent" }),
        );
        await runWithRls(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) =>
          tx.insert(schema.events).values({ tenantId: data.tenantId, customerId: r.id, type: "campaign_sent", meta: { campaignId: data.campaignId } }),
        );
      } catch {
        await sleep(1000); // transient (e.g. 429) — one retry
        try {
          await tg.sendMessage(r.tgUserId, body);
          sent++;
          await runWithRls(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) =>
            tx.insert(schema.campaignSends).values({ tenantId: data.tenantId, campaignId: data.campaignId, customerId: r.id, status: "sent" }),
          );
        } catch (err2) {
          failed++;
          await runWithRls(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) =>
            tx.insert(schema.campaignSends).values({ tenantId: data.tenantId, campaignId: data.campaignId, customerId: r.id, status: "failed", error: String((err2 as Error).message).slice(0, 200) }),
          );
        }
      }
      await sleep(50); // ~20 msg/s — within Telegram broadcast limits
    }

    await runWithRls(dbh.pool, { platform: false, tenantId: data.tenantId }, (tx) =>
      tx
        .update(schema.campaigns)
        .set({ status: "sent", stats: { recipients: recipients.length, sent, failed, skipped, finishedAt: new Date().toISOString() } })
        .where(eq(schema.campaigns.id, data.campaignId)),
    );
    await publish(data.tenantId, "campaign.sent", { campaignId: data.campaignId, sent, failed });
    log.info({ tenantId: data.tenantId, campaignId: data.campaignId, sent, failed }, "run-campaign done");
    return { ok: true, sent, failed };
  }

  // ---- flywheel: attribute real outcomes onto the AI ledger (idempotent, nightly) ----
  async function attribute(): Promise<unknown> {
    const r = await attributeOutcomes(dbh.pool, { lookbackDays: 3, windowDays: 14 });
    log.info(r, "flywheel attribution done");
    return r;
  }

  // ---- eval-runner: score the model against owner-curated golden cases ----
  async function evaluate(data: EvalJob): Promise<unknown> {
    if (!client) return { ok: false, reason: "ai_unconfigured" };
    const r = await runEval(dbh.pool, client, { task: data.task, model: data.model });
    log.info(r, "eval run done");
    return r;
  }

  // ---- rotate all secrets to the current primary key (key rotation sweep) ----
  async function rotateSecrets(): Promise<{ reEncrypted: number }> {
    if (!cipher) return { reEncrypted: 0 };
    let n = 0;
    const creds = await runWithRls(dbh.pool, { platform: true }, (tx) =>
      tx.select({ id: schema.paymentCredentials.id, v: schema.paymentCredentials.secretEnc }).from(schema.paymentCredentials).where(isNotNull(schema.paymentCredentials.secretEnc)));
    for (const r of creds) {
      const next = r.v ? cipher.reEncrypt(r.v) : null;
      if (next) {
        await runWithRls(dbh.pool, { platform: true }, (tx) => tx.update(schema.paymentCredentials).set({ secretEnc: next }).where(eq(schema.paymentCredentials.id, r.id)));
        n++;
      }
    }
    const chans = await runWithRls(dbh.pool, { platform: true }, (tx) =>
      tx.select({ id: schema.channels.id, v: schema.channels.botTokenEnc }).from(schema.channels).where(isNotNull(schema.channels.botTokenEnc)));
    for (const r of chans) {
      const next = r.v ? cipher.reEncrypt(r.v) : null;
      if (next) {
        await runWithRls(dbh.pool, { platform: true }, (tx) => tx.update(schema.channels).set({ botTokenEnc: next }).where(eq(schema.channels.id, r.id)));
        n++;
      }
    }
    const tens = await runWithRls(dbh.pool, { platform: true }, (tx) =>
      tx.select({ id: schema.tenants.id, v: schema.tenants.aiVirtualKeyEnc }).from(schema.tenants).where(isNotNull(schema.tenants.aiVirtualKeyEnc)));
    for (const r of tens) {
      const next = r.v ? cipher.reEncrypt(r.v) : null;
      if (next) {
        await runWithRls(dbh.pool, { platform: true }, (tx) => tx.update(schema.tenants).set({ aiVirtualKeyEnc: next }).where(eq(schema.tenants.id, r.id)));
        n++;
      }
    }
    log.info({ reEncrypted: n }, "secret rotation sweep done");
    return { reEncrypted: n };
  }

  return async (job: Job): Promise<unknown> => {
    if (job.name === "score-leads") return scoreLeads(job.data as ScoreJob);
    if (job.name === "run-campaign") return runCampaign(job.data as CampaignJob);
    if (job.name === "attribute") return attribute();
    if (job.name === "run-eval") return evaluate(job.data as EvalJob);
    if (job.name === "rotate-secrets") return rotateSecrets();
    log.warn({ name: job.name }, "growth: unknown job type");
    return { ok: false };
  };
}
