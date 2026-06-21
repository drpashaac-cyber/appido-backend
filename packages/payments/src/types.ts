export type PayMethod =
  | "zarinpal" | "idpay" | "nextpay" | "stripe" | "paypal"
  | "usdt_trc20" | "usdt_bep20" | "usdt_ton" | "card";

export type CheckoutStatus = "pending" | "confirmed" | "failed";

/** Central, per-Appido infra config (chain-read keys). NOT tenant secrets. */
export interface PaymentEnv {
  tronApiKey?: string;
  bscscanApiKey?: string;
  tonApiKey?: string;
}

export interface CreateCheckoutInput {
  amountCents: number; // integer minor units of `currency`
  currency: string;
  description: string;
  callbackUrl: string; // redirect gateways return the customer here
  reference: string; // our transaction id
}
export interface CheckoutResult {
  providerRef?: string; // gateway authority/id (redirect gateways)
  redirectUrl?: string; // redirect gateways (e.g. ZarinPal StartPay)
  payAddress?: string; // crypto: address to pay
  network?: string; // crypto network label
  memo?: string; // crypto memo/tag used to match the payment (TON)
  amountCrypto?: string; // crypto amount to send
  expiresAt?: string; // ISO
}
export interface VerifyInput {
  amountCents: number;
  currency: string;
  providerRef?: string; // authority/session/order id (redirect gateways)
  reference?: string; // our transaction id (some gateways verify by order_id, e.g. IDPay)
  payAddress?: string; // crypto address
  memo?: string;
  since?: string; // crypto: only consider transfers after this ISO time
}
export interface VerifyResult {
  status: CheckoutStatus;
  providerRef?: string; // confirmed ref / tx hash
  paidAmountCents?: number;
}

/** Uniform adapter implemented by every gateway. */
export interface PaymentProvider {
  readonly method: PayMethod;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult>;
  verify(input: VerifyInput): Promise<VerifyResult>;
}
