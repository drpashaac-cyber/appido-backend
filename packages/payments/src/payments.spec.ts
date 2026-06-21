import { describe, it, expect } from "vitest";
import { resolveProvider, isCryptoMethod } from "./factory";

describe("payments factory (pure)", () => {
  it("builds a ZarinPal provider from a tenant secret", () => {
    const p = resolveProvider("zarinpal", { merchantId: "m-123" });
    expect(p.method).toBe("zarinpal");
  });
  it("builds USDT providers for each chain", () => {
    expect(resolveProvider("usdt_trc20", { address: "T..." }).method).toBe("usdt_trc20");
    expect(resolveProvider("usdt_ton", { address: "E..." }).method).toBe("usdt_ton");
  });
  it("flags crypto methods", () => {
    expect(isCryptoMethod("usdt_bep20")).toBe(true);
    expect(isCryptoMethod("zarinpal")).toBe(false);
  });
  it("throws on unimplemented providers", () => {
    expect(() => resolveProvider("stripe", {})).toThrow();
  });
});
