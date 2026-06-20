import { and, desc, eq, ilike } from "drizzle-orm";
import type { Pool } from "pg";
import { runWithRls, schema } from "@appido/db";
import type { TelegramApi } from "@appido/telegram";
import type { SecretCipher } from "@appido/crypto";
import { createProductCheckout, type PaymentEnv } from "@appido/payments";
import type { LiteLlmClient } from "./client";
import { searchKnowledge } from "./rag";

type CustomerTag = "hot" | "warm" | "cold" | "vip";

export interface ToolContext {
  pool: Pool;
  client: LiteLlmClient;
  tenantId: string;
  customerId?: string | null;
  channelId?: string | null;
  telegram?: TelegramApi | null;
  tgChatId?: number | null;
  publish?: (event: { type: string; payload: unknown }) => Promise<void>;
  cipher?: SecretCipher | null; // to create real checkouts (decrypts tenant gateway keys)
  publicBaseUrl?: string;
  paymentEnv?: PaymentEnv;
  dryRun?: boolean; // advisor / playground: no side effects
}

export async function executeTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  switch (name) {
    case "get_product":
      return getProduct(ctx, typeof args.query === "string" ? args.query : undefined);
    case "search_knowledge":
      return searchKnowledge(ctx.pool, ctx.client, { tenantId: ctx.tenantId, query: String(args.query ?? ""), k: 5 });
    case "create_checkout_link":
      return createCheckoutLink(ctx, String(args.productId ?? ""));
    case "grant_access":
      return grantAccess(ctx);
    case "tag_customer":
      return tagCustomer(ctx, String(args.tag ?? "warm"));
    case "set_intent":
      return setIntent(ctx, Number(args.intent ?? 0));
    case "escalate":
      return escalate(ctx, String(args.reason ?? ""));
    case "record_lead_answer":
      return recordLeadAnswer(ctx, String(args.key ?? ""), String(args.answer ?? ""));
    case "set_consent":
      return setConsentTool(ctx, String(args.purpose ?? ""), args.granted === true);
    default:
      return { error: `unknown tool ${name}` };
  }
}

async function getProduct(ctx: ToolContext, query?: string) {
  return runWithRls(ctx.pool, { platform: false, tenantId: ctx.tenantId }, async (tx) => {
    const rows = await tx
      .select({
        id: schema.products.id,
        name: schema.products.name,
        priceCents: schema.products.priceCents,
        currency: schema.products.currency,
        durationDays: schema.products.durationDays,
        description: schema.products.description,
      })
      .from(schema.products)
      .where(query ? and(eq(schema.products.active, true), ilike(schema.products.name, `%${query}%`)) : eq(schema.products.active, true))
      .orderBy(desc(schema.products.createdAt))
      .limit(20);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      price: r.priceCents / 100,
      currency: r.currency,
      durationDays: r.durationDays,
      description: r.description,
    }));
  });
}

async function createCheckoutLink(ctx: ToolContext, productId: string) {
  if (!productId) return { error: "productId required" };
  if (ctx.dryRun) return { url: `https://pay.appido.io/c/${ctx.tenantId}/${productId}`, note: "checkout (preview)" };
  if (!ctx.cipher || !ctx.publicBaseUrl) return { error: "payments not configured" };
  try {
    const res = await createProductCheckout(ctx.pool, ctx.cipher, {
      tenantId: ctx.tenantId,
      productId,
      customerId: ctx.customerId,
      channelId: ctx.channelId,
      publicBaseUrl: ctx.publicBaseUrl,
      env: ctx.paymentEnv,
    });
    if (res.redirectUrl) return { url: res.redirectUrl };
    if (res.payAddress) return { network: res.network, address: res.payAddress, amount: res.amountCrypto, memo: res.memo };
    if (res.manual) return { note: "manual payment — the team will send instructions" };
    return { note: "checkout created" };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

async function grantAccess(ctx: ToolContext) {
  if (ctx.dryRun) return { ok: true, dryRun: true };
  if (!ctx.telegram || !ctx.tgChatId) return { error: "no telegram channel bound" };
  const link = await ctx.telegram.createChatInviteLink(ctx.tgChatId, { member_limit: 1 });
  if (ctx.customerId) {
    await runWithRls(ctx.pool, { platform: false, tenantId: ctx.tenantId }, (tx) =>
      tx.insert(schema.events).values({ tenantId: ctx.tenantId, customerId: ctx.customerId!, type: "access_granted" }),
    );
  }
  return { inviteLink: link.invite_link };
}

async function tagCustomer(ctx: ToolContext, tag: string) {
  const valid: CustomerTag = (["hot", "warm", "cold", "vip"] as const).includes(tag as CustomerTag) ? (tag as CustomerTag) : "warm";
  if (ctx.dryRun || !ctx.customerId) return { ok: true, tag: valid };
  await runWithRls(ctx.pool, { platform: false, tenantId: ctx.tenantId }, async (tx) => {
    await tx
      .update(schema.customers)
      .set({ tag: valid, isVip: valid === "vip", updatedAt: new Date() })
      .where(eq(schema.customers.id, ctx.customerId!));
    if (valid === "vip") await tx.insert(schema.events).values({ tenantId: ctx.tenantId, customerId: ctx.customerId!, type: "vip" });
  });
  return { ok: true, tag: valid };
}

async function setIntent(ctx: ToolContext, intent: number) {
  const score = Math.max(0, Math.min(100, Math.round(intent)));
  if (ctx.dryRun || !ctx.customerId) return { ok: true, intent: score };
  await runWithRls(ctx.pool, { platform: false, tenantId: ctx.tenantId }, async (tx) => {
    await tx.update(schema.customers).set({ intent: score, updatedAt: new Date() }).where(eq(schema.customers.id, ctx.customerId!));
    await tx.insert(schema.events).values({ tenantId: ctx.tenantId, customerId: ctx.customerId!, type: "lead_scored", meta: { intent: score } });
  });
  return { ok: true, intent: score };
}

async function escalate(ctx: ToolContext, reason: string) {
  if (ctx.dryRun || !ctx.customerId) return { ok: true, escalated: true, reason };
  await runWithRls(ctx.pool, { platform: false, tenantId: ctx.tenantId }, async (tx) => {
    await tx.update(schema.customers).set({ aiManaged: false, updatedAt: new Date() }).where(eq(schema.customers.id, ctx.customerId!));
    await tx.insert(schema.events).values({ tenantId: ctx.tenantId, customerId: ctx.customerId!, type: "message", meta: { escalation: reason } });
  });
  if (ctx.publish) await ctx.publish({ type: "escalation", payload: { customerId: ctx.customerId, reason } });
  return { ok: true, escalated: true };
}


// Persists a lead's onboarding answer onto customers.profile (jsonb), keyed by the script question key.
async function recordLeadAnswer(ctx: ToolContext, key: string, answer: string) {
  const k = key.trim();
  if (!k) return { ok: false, error: "missing_key" };
  if (ctx.dryRun || !ctx.customerId) return { ok: true, key: k };
  await runWithRls(ctx.pool, { platform: false, tenantId: ctx.tenantId }, async (tx) => {
    const [c] = await tx.select({ profile: schema.customers.profile }).from(schema.customers).where(eq(schema.customers.id, ctx.customerId!)).limit(1);
    const profile = { ...(((c?.profile as Record<string, unknown>) ?? {})), [k]: answer };
    await tx.update(schema.customers).set({ profile }).where(eq(schema.customers.id, ctx.customerId!));
  });
  return { ok: true as const, key: k };
}


// Records the customer's explicit consent decision (source "ai") onto customer_consent.
async function setConsentTool(ctx: ToolContext, purpose: string, granted: boolean) {
  const valid = ["marketing", "ai", "analytics"].includes(purpose) ? purpose : null;
  if (!valid) return { ok: false, error: "invalid_purpose" };
  if (ctx.dryRun || !ctx.customerId) return { ok: true as const, purpose: valid, granted };
  await runWithRls(ctx.pool, { platform: false, tenantId: ctx.tenantId }, (tx) =>
    tx
      .insert(schema.customerConsent)
      .values({ tenantId: ctx.tenantId, customerId: ctx.customerId!, purpose: valid, granted, source: "ai", at: new Date() })
      .onConflictDoUpdate({
        target: [schema.customerConsent.tenantId, schema.customerConsent.customerId, schema.customerConsent.purpose],
        set: { granted, source: "ai", at: new Date() },
      }),
  );
  return { ok: true as const, purpose: valid, granted };
}
