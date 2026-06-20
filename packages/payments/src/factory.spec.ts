import { describe, it, expect } from "vitest";
import { resolveProvider } from "./factory";
import type { PayMethod } from "./types";

const SECRETS: Record<PayMethod, Record<string, unknown>> = {
  zarinpal: { merchantId: "m" },
  idpay: { apiKey: "k" },
  nextpay: { apiKey: "k" },
  stripe: { secretKey: "sk_test" },
  paypal: { clientId: "c", clientSecret: "s" },
  usdt_trc20: { address: "T..." },
  usdt_bep20: { address: "0x..." },
  usdt_ton: { address: "EQ..." },
  card: { cardNumber: "6037...", holder: "A B" },
};

describe("resolveProvider — every PayMethod is implemented", () => {
  for (const method of Object.keys(SECRETS) as PayMethod[]) {
    it(`builds a provider for ${method}`, () => {
      const p = resolveProvider(method, SECRETS[method]);
      expect(p.method).toBe(method);
      expect(typeof p.createCheckout).toBe("function");
      expect(typeof p.verify).toBe("function");
    });
  }
});
