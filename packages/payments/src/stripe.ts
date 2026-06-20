import type { CreateCheckoutInput, CheckoutResult, PaymentProvider, VerifyInput, VerifyResult } from "./types";

// Stripe Checkout Sessions. Tenant secret: { secretKey }. Stripe amounts are minor units and match
// `amountCents` directly. Price Stripe products in USD/EUR/etc.
export class StripeProvider implements PaymentProvider {
  readonly method = "stripe" as const;
  constructor(private readonly cfg: { secretKey: string }) {}

  private async api(path: string, method: "GET" | "POST", form?: Record<string, string>): Promise<Record<string, unknown>> {
    const res = await fetch(`https://api.stripe.com${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.cfg.secretKey}`,
        ...(form ? { "content-type": "application/x-www-form-urlencoded" } : {}),
      },
      body: form ? new URLSearchParams(form).toString() : undefined,
    });
    return (await res.json().catch(() => ({}))) as Record<string, unknown>;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const json = (await this.api("/v1/checkout/sessions", "POST", {
      mode: "payment",
      success_url: `${input.callbackUrl}?status=success`,
      cancel_url: `${input.callbackUrl}?status=cancel`,
      client_reference_id: input.reference,
      "metadata[reference]": input.reference,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": input.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(input.amountCents),
      "line_items[0][price_data][product_data][name]": input.description || "Order",
    })) as { id?: string; url?: string; error?: { message?: string } };
    if (!json.id || !json.url) throw new Error(`stripe session failed: ${json.error?.message ?? JSON.stringify(json)}`);
    return { providerRef: json.id, redirectUrl: json.url };
  }

  async verify(input: VerifyInput): Promise<VerifyResult> {
    const json = (await this.api(`/v1/checkout/sessions/${input.providerRef}`, "GET")) as { payment_status?: string; payment_intent?: string; amount_total?: number };
    if (json.payment_status === "paid") {
      return { status: "confirmed", providerRef: String(json.payment_intent ?? input.providerRef ?? ""), paidAmountCents: json.amount_total != null ? Number(json.amount_total) : input.amountCents };
    }
    return { status: "pending" };
  }
}
