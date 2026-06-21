import { describe, it, expect } from "vitest";
import { sha256, newSessionToken, newNumericCode } from "./crypto";

describe("auth crypto", () => {
  it("sha256 is deterministic", () => {
    expect(sha256("hello")).toBe(sha256("hello"));
  });
  it("session tokens are random and stored only as a hash", () => {
    const a = newSessionToken();
    const b = newSessionToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).toBe(sha256(a.token));
    expect(a.tokenHash).not.toBe(a.token);
  });
  it("codes are six numeric digits", () => {
    for (let i = 0; i < 50; i++) expect(newNumericCode()).toMatch(/^\d{6}$/);
  });
});
