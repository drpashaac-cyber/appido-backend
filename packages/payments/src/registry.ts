import type { PaymentEnv, PaymentProvider } from "./types";
import { ZarinPalProvider } from "./zarinpal";
import { IdPayProvider } from "./idpay";
import { NextPayProvider } from "./nextpay";
import { StripeProvider } from "./stripe";
import { PayPalProvider } from "./paypal";
import { UsdtProvider } from "./usdt";
import { CardProvider } from "./card";

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT GATEWAY REGISTRY
//
// To add a NEW gateway, add ONE entry to GATEWAYS below — nothing else in the codebase
// needs to change. The dashboard renders its gateway grid from paymentCatalog(), so a new
// entry shows up automatically.
//
//  • A fully built gateway → set `available: true` and provide `create` (build its provider).
//  • A gateway that isn't built yet → set `available: false` and OMIT `create`. It appears in
//    the UI as "coming soon" (visible, not yet activatable). Zero implementation required.
//
// `method` is a free-form string (the DB column is text), so brand-new gateway ids need no
// migration. `fields` drives the credential form the dashboard shows for that gateway.
// ─────────────────────────────────────────────────────────────────────────────

export type CredentialKind = "key" | "wallet" | "manual";
export type GatewayGroup = "rial" | "card" | "global" | "crypto";

export interface GatewayField {
  key: string;
  label: string;
  type: "text" | "password" | "boolean";
  required?: boolean;
  placeholder?: string;
}

export interface GatewayDef {
  method: string;
  label: string;
  kind: CredentialKind;
  group: GatewayGroup;
  crypto?: boolean;
  manual?: boolean;
  available: boolean;
  fields: GatewayField[];
  /** Build a live provider from a tenant's decrypted secret. Omit for not-yet-built gateways. */
  create?: (secret: Record<string, unknown>, env: PaymentEnv) => PaymentProvider;
}

const s = (v: unknown): string => String(v ?? "");
const opt = (v: unknown): string | undefined => (v != null && v !== "" ? String(v) : undefined);

const WALLET_FIELDS: GatewayField[] = [{ key: "address", label: "Wallet address", type: "text", required: true }];

export const GATEWAYS: GatewayDef[] = [
  {
    method: "zarinpal", label: "ZarinPal", kind: "key", group: "rial", available: true,
    fields: [
      { key: "merchantId", label: "Merchant ID", type: "text", required: true },
      { key: "sandbox", label: "Sandbox", type: "boolean" },
    ],
    create: (sec) => new ZarinPalProvider({ merchantId: s(sec.merchantId), sandbox: Boolean(sec.sandbox) }),
  },
  {
    method: "idpay", label: "IDPay", kind: "key", group: "rial", available: true,
    fields: [
      { key: "apiKey", label: "API key", type: "password", required: true },
      { key: "sandbox", label: "Sandbox", type: "boolean" },
    ],
    create: (sec) => new IdPayProvider({ apiKey: s(sec.apiKey), sandbox: Boolean(sec.sandbox) }),
  },
  {
    method: "nextpay", label: "NextPay", kind: "key", group: "rial", available: true,
    fields: [{ key: "apiKey", label: "API key", type: "password", required: true }],
    create: (sec) => new NextPayProvider({ apiKey: s(sec.apiKey) }),
  },
  {
    method: "stripe", label: "Stripe", kind: "key", group: "global", available: true,
    fields: [{ key: "secretKey", label: "Secret key", type: "password", required: true }],
    create: (sec) => new StripeProvider({ secretKey: s(sec.secretKey) }),
  },
  {
    method: "paypal", label: "PayPal", kind: "key", group: "global", available: true,
    fields: [
      { key: "clientId", label: "Client ID", type: "text", required: true },
      { key: "clientSecret", label: "Client secret", type: "password", required: true },
      { key: "sandbox", label: "Sandbox", type: "boolean" },
    ],
    create: (sec) => new PayPalProvider({ clientId: s(sec.clientId), clientSecret: s(sec.clientSecret), sandbox: Boolean(sec.sandbox) }),
  },
  {
    method: "usdt_trc20", label: "USDT · TRC20", kind: "wallet", group: "crypto", crypto: true, available: true,
    fields: WALLET_FIELDS,
    create: (sec, env) => new UsdtProvider({ method: "usdt_trc20", address: s(sec.address) }, env),
  },
  {
    method: "usdt_bep20", label: "USDT · BEP20", kind: "wallet", group: "crypto", crypto: true, available: true,
    fields: WALLET_FIELDS,
    create: (sec, env) => new UsdtProvider({ method: "usdt_bep20", address: s(sec.address) }, env),
  },
  {
    method: "usdt_ton", label: "USDT · TON", kind: "wallet", group: "crypto", crypto: true, available: true,
    fields: [...WALLET_FIELDS, { key: "memo", label: "Memo / tag", type: "text" }],
    create: (sec, env) => new UsdtProvider({ method: "usdt_ton", address: s(sec.address) }, env),
  },
  {
    method: "card", label: "Card-to-card", kind: "manual", group: "card", manual: true, available: true,
    fields: [
      { key: "cardNumber", label: "Card number", type: "text" },
      { key: "holder", label: "Holder name", type: "text" },
    ],
    create: (sec) => new CardProvider({ cardNumber: opt(sec.cardNumber), holder: opt(sec.holder) }),
  },
];

const BY_METHOD = new Map<string, GatewayDef>(GATEWAYS.map((g) => [g.method, g]));

export const gatewayDef = (method: string): GatewayDef | undefined => BY_METHOD.get(method);
export const registeredMethods = (): string[] => GATEWAYS.map((g) => g.method);
export const isCryptoMethod = (method: string): boolean => Boolean(BY_METHOD.get(method)?.crypto);
export const isManualMethod = (method: string): boolean => Boolean(BY_METHOD.get(method)?.manual);

/** Public catalog (without factory fns) the dashboard uses to render the gateway grid. */
export function paymentCatalog(): Array<Omit<GatewayDef, "create">> {
  return GATEWAYS.map(({ create: _create, ...rest }) => rest);
}

/** Build a provider for a tenant's gateway. Throws for unknown or not-yet-built gateways. */
export function resolveProvider(method: string, secret: Record<string, unknown>, env: PaymentEnv = {}): PaymentProvider {
  const def = BY_METHOD.get(method);
  if (!def) throw new Error(`payment provider not registered: ${method}`);
  if (!def.available || !def.create) throw new Error(`payment provider not available yet: ${method}`);
  return def.create(secret, env);
}
