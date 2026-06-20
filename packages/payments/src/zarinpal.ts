import type { CreateCheckoutInput, CheckoutResult, PaymentProvider, VerifyInput, VerifyResult } from "./types";

// ZarinPal v4. Tenant secret: { merchantId, sandbox? }. NOTE: ZarinPal settles in IRR
// (Rials, integer, no minor unit) — products paid via ZarinPal must be priced in IRR, so
// `amountCents` is passed as the Rial amount. Confirm the unit with your merchant.
export class ZarinPalProvider implements PaymentProvider {
  readonly method = "zarinpal" as const;
  constructor(private readonly cfg: { merchantId: string; sandbox?: boolean }) {}

  private host(): string {
    return this.cfg.sandbox ? "https://sandbox.zarinpal.com" : "https://payment.zarinpal.com";
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const res = await fetch(`${this.host()}/pg/v4/payment/request.json`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        merchant_id: this.cfg.merchantId,
        amount: input.amountCents,
        callback_url: input.callbackUrl,
        description: input.description,
        metadata: { order_id: input.reference },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: { authority?: string; code?: number }; errors?: unknown };
    const authority = json.data?.authority;
    if (!authority) throw new Error(`zarinpal request failed: ${JSON.stringify(json.errors ?? json)}`);
    return { providerRef: authority, redirectUrl: `${this.host()}/pg/StartPay/${authority}` };
  }

  async verify(input: VerifyInput): Promise<VerifyResult> {
    const res = await fetch(`${this.host()}/pg/v4/payment/verify.json`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ merchant_id: this.cfg.merchantId, amount: input.amountCents, authority: input.providerRef }),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: { code?: number; ref_id?: number | string } };
    const code = json.data?.code;
    // 100 = verified now, 101 = already verified
    if (code === 100 || code === 101) {
      return { status: "confirmed", providerRef: String(json.data?.ref_id ?? input.providerRef ?? ""), paidAmountCents: input.amountCents };
    }
    return { status: "failed" };
  }
}
