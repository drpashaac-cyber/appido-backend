import type { CreateCheckoutInput, CheckoutResult, PaymentProvider, VerifyInput, VerifyResult } from "./types";

// Manual card-to-card. Tenant secret: { cardNumber?, holder? }. No gateway: the customer transfers
// to the card and the tenant confirms manually (the "manual" credential kind is normally settled by
// finalizeTransaction directly). verify() therefore stays pending.
export class CardProvider implements PaymentProvider {
  readonly method = "card" as const;
  constructor(private readonly cfg: { cardNumber?: string; holder?: string }) {}

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    return {
      providerRef: input.reference,
      payAddress: this.cfg.cardNumber,
      network: this.cfg.holder,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async verify(_input: VerifyInput): Promise<VerifyResult> {
    return { status: "pending" }; // confirmed manually by the tenant
  }
}
