import { describe, it, expect } from "vitest";
import { buildPage, clampLimit, cursorToDate, DEFAULT_LIMIT, MAX_LIMIT } from "./pagination";

describe("pagination", () => {
  it("clampLimit bounds the page size", () => {
    expect(clampLimit(undefined)).toBe(DEFAULT_LIMIT);
    expect(clampLimit(0)).toBe(DEFAULT_LIMIT);
    expect(clampLimit(10)).toBe(10);
    expect(clampLimit(9999)).toBe(MAX_LIMIT);
  });
  it("cursorToDate parses ISO or returns null", () => {
    expect(cursorToDate(undefined)).toBeNull();
    expect(cursorToDate("not-a-date")).toBeNull();
    expect(cursorToDate("2026-01-01T00:00:00.000Z")?.getUTCFullYear()).toBe(2026);
  });
  it("buildPage emits a cursor only when there is an extra row", () => {
    const rows = [{ at: new Date("2026-01-03") }, { at: new Date("2026-01-02") }, { at: new Date("2026-01-01") }];
    const full = buildPage(rows, 2, (r) => r.at);
    expect(full.items).toHaveLength(2);
    expect(full.nextCursor).toBe(new Date("2026-01-02").toISOString());
    const last = buildPage(rows, 5, (r) => r.at);
    expect(last.nextCursor).toBeNull();
  });
});
