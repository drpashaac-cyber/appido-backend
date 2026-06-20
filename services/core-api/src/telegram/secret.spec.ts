import { describe, it, expect } from "vitest";
import { safeEqual } from "./secret";

describe("safeEqual (webhook secret verification)", () => {
  it("accepts an exact match", () => {
    expect(safeEqual("s3cr3t-token", "s3cr3t-token")).toBe(true);
  });
  it("rejects a mismatch", () => {
    expect(safeEqual("s3cr3t-token", "wrong-token!!")).toBe(false);
  });
  it("rejects differing lengths without throwing", () => {
    expect(safeEqual("short", "a-much-longer-secret")).toBe(false);
  });
  it("rejects missing values", () => {
    expect(safeEqual(undefined, "x")).toBe(false);
    expect(safeEqual("x", null)).toBe(false);
  });
});
