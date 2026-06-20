import type { CreateCheckoutInput, CheckoutResult, PaymentProvider, VerifyInput, VerifyResult } from "./types";

// IDPay v1.1. Tenant secret: { apiKey, sandbox? }. IDPay settles in IRR (Rials) — price IDPay
// products in IRR so `amountCents` is the Rial amount. Confirm the unit with your merchant.
export class IdPayProvider implements PaymentProvider {
  readonly method = "idpay" as const;
  constructor(private readonly cfg: { apiKey: string; sandbox?: boolean }) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "content-type": "application/json", accept: "application/json", "X-API-KEY": this.cfg.apiKey };
    if (this.cfg.sandbox) h["X-SANDBOX"] = "1";
    return h;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const res = await fetch("https://api.idpay.ir/v1.1/payment", {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ order_id: input.reference, amount: input.amountCents, callback: input.callbackUrl, desc: input.description }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; link?: string; error_message?: string };
    if (!json.id || !json.link) throw new Error(`idpay request failed: ${json.error_message ?? JSON.stringify(json)}`);
    return { providerRef: json.id, redirectUrl: json.link };
  }

  async verify(input: VerifyInput): Promise<VerifyResult> {
    const res = await fetch("https://api.idpay.ir/v1.1/payment/verify", {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ id: input.providerRef, order_id: input.reference }),
    });
    const json = (await res.json().catch(() => ({}))) as { status?: string | number; track_id?: string | number; amount?: string | number };
    const status = Number(json.status);
    // 100 verified · 101 already verified · 200 settled to payee
    if (status === 100 || status === 101 || status === 200) {
      return { status: "confirmed", providerRef: String(json.track_id ?? input.providerRef ?? ""), paidAmountCents: json.amount != null ? Number(json.amount) : input.amountCents };
    }
    return { status: "pending" };
  }
}
