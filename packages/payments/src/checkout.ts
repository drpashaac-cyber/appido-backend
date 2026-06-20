import { and, eq } from "drizzle-orm";
import type { Pool } from "pg";
import { runWithRls, schema } from "@appido/db";
import type { SecretCipher } from "@appido/crypto";
import type { PaymentEnv, PayMethod } from "./types";
import { resolveProvider } from "./factory";

export interface CheckoutOutput {
  transactionId: string;
  redirectUrl?: string;
  payAddress?: string;
  network?: string;
  amountCrypto?: string;
  memo?: string;
  manual?: boolean;
}

/** Create a checkout for one of the tenant's products, billing the customer via the
 *  TENANT's own gateway credentials. Records a pending GMV transaction. */
export async function createProductCheckout(
  pool: Pool,
  cipher: SecretCipher,
  input: {
    tenantId: string;
    productId: string;
    customerId?: string | null;
    channelId?: string | null;
    publicBaseUrl: string;
    method?: PayMethod;
    env?: PaymentEnv;
  },
): Promise<CheckoutOutput> {
  return runWithRls(pool, { platform: false, tenantId: input.tenantId }, async (tx) => {
    const [product] = await tx
      .select()
      .from(schema.products)
      .where(and(eq(schema.products.id, input.productId), eq(schema.products.active, true)))
      .limit(1);
    if (!product) throw new Error("product_not_found");

    const creds = await tx.select().from(schema.paymentCredentials).where(eq(schema.paymentCredentials.enabled, true));
    const cred = input.method ? creds.find((c) => c.method === input.method) : creds[0];
    if (!cred) throw new Error("no_enabled_payment_method");

    const [trx] = await tx
      .insert(schema.transactions)
      .values({
        tenantId: input.tenantId,
        channelId: input.channelId ?? null,
        customerId: input.customerId ?? null,
        productId: product.id,
        amountCents: product.priceCents,
        currency: product.currency,
        gateway: cred.method,
        status: "pending",
      })
      .returning({ id: schema.transactions.id });
    const transactionId = trx.id;

    if (cred.kind === "manual") {
      await tx
        .update(schema.transactions)
        .set({ expiresAt: new Date(Date.now() + 24 * 3600 * 1000) })
        .where(eq(schema.transactions.id, transactionId));
      return { transactionId, manual: true };
    }

    const secret = JSON.parse(cipher.decrypt(cred.secretEnc ?? "")) as Record<string, unknown>;
    const provider = resolveProvider(cred.method, secret, input.env);
    const result = await provider.createCheckout({
      amountCents: product.priceCents,
      currency: product.currency,
      description: product.name,
      callbackUrl: `${input.publicBaseUrl}/pay/callback/${transactionId}`,
      reference: transactionId,
    });
    await tx
      .update(schema.transactions)
      .set({
        providerRef: result.providerRef ?? null,
        expiresAt: result.expiresAt ? new Date(result.expiresAt) : null,
        receipt: {
          redirectUrl: result.redirectUrl,
          payAddress: result.payAddress,
          network: result.network,
          amountCrypto: result.amountCrypto,
          memo: result.memo,
        },
      })
      .where(eq(schema.transactions.id, transactionId));

    return {
      transactionId,
      redirectUrl: result.redirectUrl,
      payAddress: result.payAddress,
      network: result.network,
      amountCrypto: result.amountCrypto,
      memo: result.memo,
    };
  });
}
