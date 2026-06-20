import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type IdentityKind = "telegram" | "email" | "phone" | "web" | "whatsapp";

export interface ResolveCustomerInput {
  tenantId: string;
  channelId?: string | null;
  kind: IdentityKind;
  value: string;
  name?: string;
  handle?: string | null;
  locale?: string | null;
}

export interface ResolvedCustomer {
  customerId: string;
  isNew: boolean;
}

/**
 * Identity resolution (customer-360 seam): map a channel-specific identity to the
 * canonical customer, creating both on first contact. Today Telegram is the only
 * writer; website / email / whatsapp become additive — no painful migration later.
 * Must run inside a tenant RLS transaction.
 */
export async function resolveCustomer(
  tx: NodePgDatabase<typeof schema>,
  input: ResolveCustomerInput,
): Promise<ResolvedCustomer> {
  const found = await tx
    .select({ customerId: schema.customerIdentities.customerId })
    .from(schema.customerIdentities)
    .where(
      and(
        eq(schema.customerIdentities.tenantId, input.tenantId),
        eq(schema.customerIdentities.kind, input.kind),
        eq(schema.customerIdentities.value, input.value),
      ),
    )
    .limit(1);

  if (found[0]) {
    await tx.update(schema.customers).set({ updatedAt: new Date() }).where(eq(schema.customers.id, found[0].customerId));
    return { customerId: found[0].customerId, isNew: false };
  }

  const [customer] = await tx
    .insert(schema.customers)
    .values({
      tenantId: input.tenantId,
      channelId: input.channelId ?? null,
      tgUserId: input.kind === "telegram" ? Number(input.value) : null,
      name: input.name ?? "Customer",
      handle: input.handle ?? null,
      locale: input.locale ?? null,
      tag: "cold",
      aiManaged: true,
    })
    .returning({ id: schema.customers.id });

  await tx.insert(schema.customerIdentities).values({
    tenantId: input.tenantId,
    customerId: customer.id,
    kind: input.kind,
    value: input.value,
    verified: input.kind === "telegram", // authenticated by the verified webhook
  });

  return { customerId: customer.id, isNew: true };
}
