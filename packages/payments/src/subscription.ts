import { randomInt } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Pool } from "pg";
import { emitEvent, runWithRls, schema } from "@appido/db";
import { resolveProvider } from "./factory";
import type { PaymentEnv, PayMethod } from "./types";

// Appido's OWN subscription pricing — Appido's product, NEVER a tenant's products.
export type AppidoPlan = "start" | "pro";
export const APPIDO_PLANS: Record<AppidoPlan, { amountCents: number; currency: string; periodDays: number }> = {
  start: { amountCents: 7900, currency: "USD", periodDays: 30 }, // $79/mo
  pro: { amountCents: 17900, currency: "USD", periodDays: 30 }, //  $179/mo
};

/** Activate (or extend) a tenant's Appido subscription. MRR — never touches `transactions`. */
export async function activateSubscription(
  pool: Pool,
  input: { tenantId: string; subscriptionId?: string; plan: string; periodDays?: number; pricing?: { amountCents: number; currency: string; periodDays: number }; providerRef?: string; activationCode?: string },
): Promise<{ id: string }> {
  const pr = input.pricing ?? APPIDO_PLANS[input.plan as AppidoPlan];
  const days = input.periodDays ?? pr?.periodDays ?? 30;
  const start = new Date();
  const end = new Date(Date.now() + days * 24 * 3600 * 1000);
  return runWithRls(pool, { platform: false, tenantId: input.tenantId }, async (tx) => {
    if (input.subscriptionId) {
      const rows = await tx
        .update(schema.subscriptions)
        .set({ status: "active", periodStart: start, periodEnd: end, ...(input.providerRef ? { providerRef: input.providerRef } : {}) })
        .where(eq(schema.subscriptions.id, input.subscriptionId))
        .returning({ id: schema.subscriptions.id });
      if (rows.length) {
        await emitEvent(tx, { tenantId: input.tenantId, type: "subscription.updated", payload: { plan: input.plan } });
        return { id: rows[0].id };
      }
    }
    const [row] = await tx
      .insert(schema.subscriptions)
      .values({
        tenantId: input.tenantId,
        plan: input.plan,
        status: "active",
        periodStart: start,
        periodEnd: end,
        amountCents: pr?.amountCents ?? 0,
        currency: pr?.currency ?? "USD",
        activationCode: input.activationCode ?? null,
        providerRef: input.providerRef ?? null,
      })
      .returning({ id: schema.subscriptions.id });
    await emitEvent(tx, { tenantId: input.tenantId, type: "subscription.updated", payload: { plan: input.plan } });
    return { id: row.id };
  });
}

/** Redeem an activation code: platform-ctx lookup of an unredeemed code, race-safe claim,
 *  then activate the subscription under the tenant context. */
export async function redeemActivationCode(
  pool: Pool,
  input: { tenantId: string; code: string },
): Promise<{ ok: boolean; plan?: AppidoPlan; periodEnd?: string; error?: string }> {
  const claim = await runWithRls(pool, { platform: true }, async (tx) => {
    const [c] = await tx
      .select({ id: schema.activationCodes.id })
      .from(schema.activationCodes)
      .where(and(eq(schema.activationCodes.code, input.code), isNull(schema.activationCodes.redeemedAt)))
      .limit(1);
    if (!c) return null;
    // conditional update guards against two tenants redeeming the same code concurrently
    const rows = await tx
      .update(schema.activationCodes)
      .set({ redeemedByTenant: input.tenantId, redeemedAt: new Date() })
      .where(and(eq(schema.activationCodes.id, c.id), isNull(schema.activationCodes.redeemedAt)))
      .returning({ plan: schema.activationCodes.plan, durationDays: schema.activationCodes.durationDays });
    return rows[0] ?? null;
  });
  if (!claim) return { ok: false, error: "invalid_or_used" };

  const plan = claim.plan as AppidoPlan;
  const start = new Date();
  const end = new Date(Date.now() + claim.durationDays * 24 * 3600 * 1000);
  await runWithRls(pool, { platform: false, tenantId: input.tenantId }, async (tx) => {
    await tx.insert(schema.subscriptions).values({
      tenantId: input.tenantId,
      plan,
      status: "active",
      periodStart: start,
      periodEnd: end,
      amountCents: 0, // comp/reseller: no gateway payment captured here
      currency: APPIDO_PLANS[plan]?.currency ?? "USD",
      activationCode: input.code,
    });
    await emitEvent(tx, { tenantId: input.tenantId, type: "subscription.updated", payload: { plan, via: "code" } });
  });
  return { ok: true, plan, periodEnd: end.toISOString() };
}

/** Start an Appido-gateway checkout for a plan, using APPIDO's own credentials (not a tenant's). */
export async function createSubscriptionCheckout(
  pool: Pool,
  input: {
    tenantId: string;
    plan: string;
    pricing?: { amountCents: number; currency: string; periodDays: number };
    gateway: { method: PayMethod; secret: Record<string, unknown>; env?: PaymentEnv };
    publicBaseUrl: string;
  },
): Promise<{ subscriptionId: string; redirectUrl?: string; payAddress?: string; network?: string; amountCrypto?: string; memo?: string }> {
  const plan = input.pricing ?? APPIDO_PLANS[input.plan as AppidoPlan] ?? { amountCents: 0, currency: "USD", periodDays: 30 };
  return runWithRls(pool, { platform: false, tenantId: input.tenantId }, async (tx) => {
    const [sub] = await tx
      .insert(schema.subscriptions)
      .values({
        tenantId: input.tenantId,
        plan: input.plan,
        status: "past_due", // awaiting first payment; flips to active on confirmation
        amountCents: plan.amountCents,
        currency: plan.currency,
        gateway: input.gateway.method,
      })
      .returning({ id: schema.subscriptions.id });
    const provider = resolveProvider(input.gateway.method, input.gateway.secret, input.gateway.env);
    const result = await provider.createCheckout({
      amountCents: plan.amountCents,
      currency: plan.currency,
      description: `Appido ${input.plan} subscription`,
      callbackUrl: `${input.publicBaseUrl}/billing/callback/${sub.id}`,
      reference: sub.id,
    });
    await tx.update(schema.subscriptions).set({ providerRef: result.providerRef ?? null }).where(eq(schema.subscriptions.id, sub.id));
    return {
      subscriptionId: sub.id,
      redirectUrl: result.redirectUrl,
      payAddress: result.payAddress,
      network: result.network,
      amountCrypto: result.amountCrypto,
      memo: result.memo,
    };
  });
}

function mintCode(): string {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // unambiguous
  const g = () => Array.from({ length: 4 }, () => A[randomInt(A.length)]).join("");
  return `APD-${g()}-${g()}-${g()}`;
}

/** Owner-only: mint a batch of activation codes. */
export async function generateActivationCodes(
  pool: Pool,
  input: { plan: AppidoPlan; durationDays?: number; count?: number; note?: string },
): Promise<{ codes: string[] }> {
  const n = Math.min(Math.max(input.count ?? 1, 1), 200);
  const days = input.durationDays ?? APPIDO_PLANS[input.plan].periodDays;
  const codes = Array.from({ length: n }, mintCode);
  await runWithRls(pool, { platform: true }, (tx) =>
    tx.insert(schema.activationCodes).values(codes.map((code) => ({ code, plan: input.plan, durationDays: days, note: input.note ?? null }))),
  );
  return { codes };
}

/** Owner-only: list issued codes (most recent first). */
export function listActivationCodes(pool: Pool, opts?: { limit?: number }) {
  return runWithRls(pool, { platform: true }, (tx) =>
    tx.select().from(schema.activationCodes).orderBy(desc(schema.activationCodes.createdAt)).limit(opts?.limit ?? 100),
  );
}
