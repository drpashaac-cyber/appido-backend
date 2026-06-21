import type { CreateCheckoutInput, CheckoutResult, PaymentProvider, VerifyInput, VerifyResult } from "./types";

// PayPal Orders v2. Tenant secret: { clientId, clientSecret, sandbox? }. PayPal amounts are major
// units (e.g. "10.00"). Price PayPal products in the same currency.
export class PayPalProvider implements PaymentProvider {
  readonly method = "paypal" as const;
  constructor(private readonly cfg: { clientId: string; clientSecret: string; sandbox?: boolean }) {}

  private host(): string {
    return this.cfg.sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
  }

  private async token(): Promise<string> {
    const basic = btoa(`${this.cfg.clientId}:${this.cfg.clientSecret}`);
    const res = await fetch(`${this.host()}/v1/oauth2/token`, {
      method: "POST",
      headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    const json = (await res.json().catch(() => ({}))) as { access_token?: string };
    if (!json.access_token) throw new Error("paypal auth failed");
    return json.access_token;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const token = await this.token();
    const res = await fetch(`${this.host()}/v2/checkout/orders`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{ reference_id: input.reference, amount: { currency_code: input.currency, value: (input.amountCents / 100).toFixed(2) } }],
        application_context: { return_url: `${input.callbackUrl}?status=success`, cancel_url: `${input.callbackUrl}?status=cancel` },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; links?: { rel?: string; href?: string }[] };
    const approve = (json.links ?? []).find((l) => l.rel === "approve")?.href;
    if (!json.id || !approve) throw new Error(`paypal order failed: ${JSON.stringify(json)}`);
    return { providerRef: json.id, redirectUrl: approve };
  }

  async verify(input: VerifyInput): Promise<VerifyResult> {
    const token = await this.token();
    // Capture the buyer-approved order (idempotent: a re-capture/GET reports COMPLETED).
    const cap = await fetch(`${this.host()}/v2/checkout/orders/${input.providerRef}/capture`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    });
    let json = (await cap.json().catch(() => ({}))) as { status?: string; purchase_units?: { payments?: { captures?: { id?: string; amount?: { value?: string } }[] } }[] };
    if (cap.status === 422) {
      const get = await fetch(`${this.host()}/v2/checkout/orders/${input.providerRef}`, { headers: { authorization: `Bearer ${token}` } });
      json = (await get.json().catch(() => ({}))) as typeof json;
    }
    if (json.status === "COMPLETED") {
      const capture = json.purchase_units?.[0]?.payments?.captures?.[0];
      const paid = capture?.amount?.value != null ? Math.round(Number(capture.amount.value) * 100) : input.amountCents;
      return { status: "confirmed", providerRef: String(capture?.id ?? input.providerRef ?? ""), paidAmountCents: paid };
    }
    return { status: "pending" };
  }
}
