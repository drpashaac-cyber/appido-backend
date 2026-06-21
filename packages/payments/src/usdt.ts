import type { CreateCheckoutInput, CheckoutResult, PaymentEnv, PaymentProvider, VerifyInput, VerifyResult } from "./types";

type UsdtMethod = "usdt_trc20" | "usdt_bep20" | "usdt_ton";

// USDT contract / jetton addresses + decimals per chain.
const USDT = {
  usdt_trc20: { contract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", decimals: 6, label: "TRON (TRC20)" },
  usdt_bep20: { contract: "0x55d398326f99059fF775485246999027B3197955", decimals: 18, label: "BSC (BEP20)" },
  usdt_ton: { contract: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs", decimals: 6, label: "TON" },
} as const;

interface Incoming {
  amount: number;
  txHash: string;
  memo?: string;
  at: number; // epoch ms
}

// Watches a tenant's wallet for an incoming USDT transfer matching the expected amount.
// Tenant secret: { address }. Chain-read keys come from central PaymentEnv.
export class UsdtProvider implements PaymentProvider {
  readonly method: UsdtMethod;
  constructor(
    private readonly cfg: { method: UsdtMethod; address: string },
    private readonly env: PaymentEnv = {},
  ) {
    this.method = cfg.method;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const meta = USDT[this.cfg.method];
    const amountCrypto = (input.amountCents / 100).toFixed(2); // currency assumed USDT
    const memo = this.cfg.method === "usdt_ton" ? input.reference.replace(/-/g, "").slice(0, 16) : undefined;
    return {
      payAddress: this.cfg.address,
      network: meta.label,
      amountCrypto,
      memo,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  }

  async verify(input: VerifyInput): Promise<VerifyResult> {
    const address = input.payAddress ?? this.cfg.address;
    const since = input.since ? Date.parse(input.since) : 0;
    const need = input.amountCents / 100;
    const incoming = await this.fetchIncoming(address).catch(() => [] as Incoming[]);
    const match = incoming.find(
      (t) => t.at >= since - 60_000 && t.amount + 1e-6 >= need && (!input.memo || t.memo === input.memo),
    );
    if (match) return { status: "confirmed", providerRef: match.txHash, paidAmountCents: Math.round(match.amount * 100) };
    return { status: "pending" };
  }

  private async fetchIncoming(address: string): Promise<Incoming[]> {
    if (this.cfg.method === "usdt_trc20") return this.fetchTron(address);
    if (this.cfg.method === "usdt_bep20") return this.fetchBsc(address);
    return this.fetchTon(address);
  }

  private async fetchTron(address: string): Promise<Incoming[]> {
    const meta = USDT.usdt_trc20;
    const url = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?only_to=true&contract_address=${meta.contract}&limit=50`;
    const res = await fetch(url, { headers: this.env.tronApiKey ? { "TRON-PRO-API-KEY": this.env.tronApiKey } : {} });
    const json = (await res.json().catch(() => ({}))) as { data?: { value?: string; transaction_id?: string; block_timestamp?: number }[] };
    return (json.data ?? []).map((t) => ({
      amount: Number(t.value ?? 0) / 10 ** meta.decimals,
      txHash: String(t.transaction_id ?? ""),
      at: Number(t.block_timestamp ?? 0),
    }));
  }

  private async fetchBsc(address: string): Promise<Incoming[]> {
    const meta = USDT.usdt_bep20;
    const url = `https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${meta.contract}&address=${address}&sort=desc&apikey=${this.env.bscscanApiKey ?? ""}`;
    const res = await fetch(url);
    const json = (await res.json().catch(() => ({}))) as { result?: { value?: string; hash?: string; timeStamp?: string; to?: string }[] };
    return (Array.isArray(json.result) ? json.result : [])
      .filter((t) => (t.to ?? "").toLowerCase() === address.toLowerCase())
      .map((t) => ({
        amount: Number(t.value ?? 0) / 10 ** meta.decimals,
        txHash: String(t.hash ?? ""),
        at: Number(t.timeStamp ?? 0) * 1000,
      }));
  }

  private async fetchTon(address: string): Promise<Incoming[]> {
    const url = `https://toncenter.com/api/v3/jetton/transfers?owner_address=${address}&direction=in&limit=50`;
    const res = await fetch(url, { headers: this.env.tonApiKey ? { "X-API-Key": this.env.tonApiKey } : {} });
    const json = (await res.json().catch(() => ({}))) as { jetton_transfers?: { amount?: string; transaction_hash?: string; transaction_now?: number; forward_payload?: string; comment?: string }[] };
    const meta = USDT.usdt_ton;
    return (json.jetton_transfers ?? []).map((t) => ({
      amount: Number(t.amount ?? 0) / 10 ** meta.decimals,
      txHash: String(t.transaction_hash ?? ""),
      memo: t.comment ?? undefined,
      at: Number(t.transaction_now ?? 0) * 1000,
    }));
  }
}
