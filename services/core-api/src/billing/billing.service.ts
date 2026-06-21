import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { and, desc, eq, gt } from "drizzle-orm";
import { runWithRls, schema, type DbHandle, type RlsContext } from "@appido/db";
import {
  activateSubscription,
  createSubscriptionCheckout,
  generateActivationCodes,
  listActivationCodes,
  redeemActivationCode,
  resolveProvider,
  type AppidoPlan,
  type PayMethod,
} from "@appido/payments";
import type { AppConfig } from "@appido/config";
import { DB } from "../db/db.module";
import { APP_CONFIG } from "../config/config.module";
import { PlansService } from "../plans/plans.service";

@Injectable()
export class BillingService {
  constructor(
    @Inject(DB) private readonly dbh: DbHandle,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly plans: PlansService,
  ) {}

  private env() {
    return { tronApiKey: this.config.TRON_API_KEY, bscscanApiKey: this.config.BSCSCAN_API_KEY, tonApiKey: this.config.TON_API_KEY };
  }
  // Appido's OWN gateway (central, from config) — never a tenant's keys.
  private gateway(): { method: PayMethod; secret: Record<string, unknown>; env: ReturnType<BillingService["env"]> } | null {
    if (!this.config.APPIDO_PAY_SECRET) return null;
    try {
      return { method: this.config.APPIDO_PAY_METHOD as PayMethod, secret: JSON.parse(this.config.APPIDO_PAY_SECRET) as Record<string, unknown>, env: this.env() };
    } catch {
      return null;
    }
  }

  async currentSubscription(ctx: RlsContext) {
    const now = new Date();
    const [sub] = await runWithRls(this.dbh.pool, ctx, (tx) =>
      tx
        .select({ plan: schema.subscriptions.plan, status: schema.subscriptions.status, periodEnd: schema.subscriptions.periodEnd })
        .from(schema.subscriptions)
        .where(and(eq(schema.subscriptions.status, "active"), gt(schema.subscriptions.periodEnd, now)))
        .orderBy(desc(schema.subscriptions.createdAt))
        .limit(1),
    );
    return { subscription: sub ?? null, plans: await this.plans.listPublic() };
  }

  async checkout(ctx: RlsContext, plan: string) {
    const gw = this.gateway();
    if (!gw) throw new ServiceUnavailableException("appido_billing_not_configured");
    const pr = await this.plans.pricing(plan);
    if (!pr || !pr.active) throw new BadRequestException("plan_unavailable");
    return createSubscriptionCheckout(this.dbh.pool, {
      tenantId: ctx.tenantId!,
      plan,
      pricing: { amountCents: pr.priceCents, currency: pr.currency, periodDays: pr.periodDays },
      gateway: gw,
      publicBaseUrl: this.config.PUBLIC_BASE_URL,
    });
  }

  async redeem(ctx: RlsContext, code: string) {
    const r = await redeemActivationCode(this.dbh.pool, { tenantId: ctx.tenantId!, code });
    return r;
  }

  // owner-only (billing:manage)
  issueCodes(_ctx: RlsContext, body: { plan: AppidoPlan; durationDays?: number; count?: number; note?: string }) {
    return generateActivationCodes(this.dbh.pool, body);
  }
  listCodes(_ctx: RlsContext) {
    return listActivationCodes(this.dbh.pool);
  }

  // public ZarinPal return for an Appido subscription payment
  async zarinpalCallback(subscriptionId: string, authority: string, status: string): Promise<{ ok: boolean }> {
    const sub = await runWithRls(this.dbh.pool, { platform: true }, async (tx) => {
      const [r] = await tx.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, subscriptionId)).limit(1);
      return r ?? null;
    });
    if (!sub) return { ok: false };
    if (sub.status === "active") return { ok: true }; // idempotent
    if (status !== "OK") return { ok: false };
    const gw = this.gateway();
    if (!gw) return { ok: false };
    const provider = resolveProvider(gw.method, gw.secret, gw.env);
    const v = await provider.verify({ amountCents: sub.amountCents, currency: sub.currency, providerRef: authority });
    if (v.status !== "confirmed") return { ok: false };
    const pr = await this.plans.pricing(sub.plan);
    await activateSubscription(this.dbh.pool, { tenantId: sub.tenantId, subscriptionId, plan: sub.plan, periodDays: pr?.periodDays, providerRef: v.providerRef });
    return { ok: true };
  }
}
