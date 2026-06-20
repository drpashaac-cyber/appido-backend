import type { CreateCheckoutInput, CheckoutResult, PaymentProvider, VerifyInput, VerifyResult } from "./types";

// NextPay. Tenant secret: { apiKey }. NextPay's amount unit (Rial vs Toman) follows your gateway
// config — price NextPay products to match. `amountCents` is sent as-is.
export class NextPayProvider implements PaymentProvider {
  readonly method = "nextpay" as const;
  constructor(private readonly cfg: { apiKey: string }) {}

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const res = await fetch("https://nextpay.org/nx/gateway/token", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ api_key: this.cfg.apiKey, amount: input.amountCents, order_id: input.reference, callback_uri: input.callbackUrl }),
    });
    const json = (await res.json().catch(() => ({}))) as { code?: number; trans_id?: string };
    if (!json.trans_id) throw new Error(`nextpay token failed: code ${json.code}`);
    return { providerRef: json.trans_id, redirectUrl: `https://nextpay.org/nx/gateway/payment/${json.trans_id}` };
  }

  async verify(input: VerifyInput): Promise<VerifyResult> {
    const res = await fetch("https://nextpay.org/nx/gateway/verify", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ api_key: this.cfg.apiKey, trans_id: input.providerRef, amount: input.amountCents }),
    });
    const json = (await res.json().catch(() => ({}))) as { code?: number; amount?: number };
    const code = Number(json.code);
    // 0 = paid & verified · -1 = not paid yet (pending) · other = failed
    if (code === 0) return { status: "confirmed", providerRef: String(input.providerRef ?? ""), paidAmountCents: json.amount != null ? Number(json.amount) : input.amountCents };
    if (code === -1) return { status: "pending" };
    return { status: "failed" };
  }
}
