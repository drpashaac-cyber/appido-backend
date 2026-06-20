import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { runWithRls, schema, type DbHandle, type RlsContext } from "@appido/db";
import { SecretCipher } from "@appido/crypto";
import { finalizeTransaction, gatewayDef, paymentCatalog, resolveProvider, type PayMethod } from "@appido/payments";
import type { AppConfig } from "@appido/config";
import { DB } from "../db/db.module";
import { APP_CONFIG } from "../config/config.module";
import { SECRET_CIPHER } from "../crypto/crypto.module";

type PayKind = "key" | "wallet" | "manual";

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DB) private readonly dbh: DbHandle,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private env() {
    return { tronApiKey: this.config.TRON_API_KEY, bscscanApiKey: this.config.BSCSCAN_API_KEY, tonApiKey: this.config.TON_API_KEY };
  }

  /** Gateway catalog from the registry (incl. "coming soon"); no secrets, safe to expose. */
  catalog() {
    return paymentCatalog();
  }

  /** method -> enabled for any policy rows present (absent = enabled). */
  async gatewayPolicyMap(): Promise<Record<string, boolean>> {
    const rows = await runWithRls(this.dbh.pool, { platform: true }, (tx) =>
      tx.select({ method: schema.appidoGatewayPolicy.method, enabled: schema.appidoGatewayPolicy.enabled }).from(schema.appidoGatewayPolicy),
    );
    const map: Record<string, boolean> = {};
    for (const r of rows) map[r.method] = r.enabled;
    return map;
  }

  /** Tenant-facing catalog with the platform policy applied (adds platformEnabled). */
  async catalogWithPolicy() {
    const pol = await this.gatewayPolicyMap();
    return paymentCatalog().map((g) => ({ ...g, platformEnabled: pol[g.method] !== false }));
  }

  /** Owner view — every registry method with its platform on/off state. */
  async listGatewayPolicy() {
    const pol = await this.gatewayPolicyMap();
    return paymentCatalog().map((g) => ({ method: g.method, label: g.label, group: g.group, crypto: !!g.crypto, available: g.available, enabled: pol[g.method] !== false }));
  }

  /** Owner sets a method on/off for all tenants. */
  async setGatewayPolicy(method: string, enabled: boolean) {
    if (!gatewayDef(method)) throw new BadRequestException("payment_method_unknown");
    await runWithRls(this.dbh.pool, { platform: true }, (tx) =>
      tx
        .insert(schema.appidoGatewayPolicy)
        .values({ method, enabled, updatedAt: new Date() })
        .onConflictDoUpdate({ target: schema.appidoGatewayPolicy.method, set: { enabled, updatedAt: new Date() } }),
    );
    return { method, enabled };
  }

  listCredentials(ctx: RlsContext) {
    // never returns secret_enc
    return runWithRls(this.dbh.pool, ctx, (tx) =>
      tx
        .select({
          id: schema.paymentCredentials.id,
          method: schema.paymentCredentials.method,
          kind: schema.paymentCredentials.kind,
          enabled: schema.paymentCredentials.enabled,
          verifiedAt: schema.paymentCredentials.verifiedAt,
          createdAt: schema.paymentCredentials.createdAt,
        })
        .from(schema.paymentCredentials),
    );
  }

  async upsertCredential(ctx: RlsContext, input: { method: PayMethod; kind: PayKind; secret?: Record<string, unknown> }) {
    const def = gatewayDef(input.method);
    if (!def) throw new BadRequestException("payment_method_unknown");
    if (!def.available) throw new BadRequestException("payment_method_coming_soon");
    const pol = await this.gatewayPolicyMap();
    if (pol[input.method] === false) throw new BadRequestException("payment_method_disabled");
    const secretEnc = input.kind === "manual" ? null : this.cipher.encrypt(JSON.stringify(input.secret ?? {}));
    return runWithRls(this.dbh.pool, ctx, async (tx) => {
      const [existing] = await tx
        .select({ id: schema.paymentCredentials.id })
        .from(schema.paymentCredentials)
        .where(eq(schema.paymentCredentials.method, input.method))
        .limit(1);
      if (existing) {
        await tx
          .update(schema.paymentCredentials)
          .set({ kind: input.kind, secretEnc, verifiedAt: null })
          .where(eq(schema.paymentCredentials.id, existing.id));
        return { id: existing.id, updated: true };
      }
      const [row] = await tx
        .insert(schema.paymentCredentials)
        .values({ tenantId: ctx.tenantId!, method: input.method, kind: input.kind, secretEnc, enabled: false })
        .returning({ id: schema.paymentCredentials.id });
      return { id: row.id, updated: false };
    });
  }

  async setEnabled(ctx: RlsContext, id: string, enabled: boolean) {
    const rows = await runWithRls(this.dbh.pool, ctx, (tx) =>
      tx.update(schema.paymentCredentials).set({ enabled }).where(eq(schema.paymentCredentials.id, id)).returning({ id: schema.paymentCredentials.id }),
    );
    if (rows.length === 0) throw new NotFoundException("credential_not_found");
    return { ok: true, enabled };
  }

  async deleteCredential(ctx: RlsContext, id: string) {
    await runWithRls(this.dbh.pool, ctx, (tx) => tx.delete(schema.paymentCredentials).where(eq(schema.paymentCredentials.id, id)));
    return { ok: true };
  }

  /** Tenant marks an offline/manual payment as received. */
  async confirmManual(ctx: RlsContext, transactionId: string) {
    return finalizeTransaction(this.dbh.pool, this.cipher, { tenantId: ctx.tenantId!, transactionId });
  }

  /** Public gateway return (browser redirect): verify with the tenant's own gateway, then finalize.
   *  Works for every redirect gateway (ZarinPal/IDPay/NextPay/Stripe/PayPal). verify() is the
   *  authoritative server-to-server check; query params only short-circuit explicit cancellation. */
  async gatewayCallback(transactionId: string, query: Record<string, string>): Promise<{ ok: boolean }> {
    const trx = await runWithRls(this.dbh.pool, { platform: true }, async (t) => {
      const [r] = await t.select().from(schema.transactions).where(eq(schema.transactions.id, transactionId)).limit(1);
      return r ?? null;
    });
    if (!trx) return { ok: false };
    if (trx.status !== "pending") return { ok: trx.status === "ok" }; // idempotent

    const method = trx.gateway as PayMethod;
    const fail = () =>
      runWithRls(this.dbh.pool, { platform: false, tenantId: trx.tenantId }, (t) =>
        t.update(schema.transactions).set({ status: "fail" }).where(eq(schema.transactions.id, transactionId)),
      );

    const statusQ = (query.Status ?? query.status ?? "").toLowerCase();
    if (statusQ === "nok" || statusQ === "cancel" || statusQ === "canceled" || statusQ === "failed") {
      await fail();
      return { ok: false };
    }

    const cred = await runWithRls(this.dbh.pool, { platform: false, tenantId: trx.tenantId }, async (t) => {
      const [c] = await t.select().from(schema.paymentCredentials).where(eq(schema.paymentCredentials.method, method)).limit(1);
      return c ?? null;
    });
    if (!cred?.secretEnc) {
      await fail();
      return { ok: false };
    }
    const secret = JSON.parse(this.cipher.decrypt(cred.secretEnc)) as Record<string, unknown>;
    const provider = resolveProvider(method, secret, this.env());
    const providerRef = trx.providerRef ?? query.Authority ?? query.authority ?? query.id ?? query.token ?? undefined;
    const v = await provider.verify({ amountCents: trx.amountCents, currency: trx.currency, providerRef, reference: transactionId });
    if (v.status === "confirmed") {
      await finalizeTransaction(this.dbh.pool, this.cipher, { tenantId: trx.tenantId, transactionId, providerRef: v.providerRef });
      return { ok: true };
    }
    await fail();
    return { ok: false };
  }

  /** Back-compat ZarinPal return → generic callback. */
  async zarinpalCallback(transactionId: string, authority: string, status: string): Promise<{ ok: boolean }> {
    return this.gatewayCallback(transactionId, { Authority: authority, Status: status });
  }
}
