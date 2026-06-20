"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const pagination_1 = require("./pagination");
(0, vitest_1.describe)("pagination", () => {
    (0, vitest_1.it)("clampLimit bounds the page size", () => {
        (0, vitest_1.expect)((0, pagination_1.clampLimit)(undefined)).toBe(pagination_1.DEFAULT_LIMIT);
        (0, vitest_1.expect)((0, pagination_1.clampLimit)(0)).toBe(pagination_1.DEFAULT_LIMIT);
        (0, vitest_1.expect)((0, pagination_1.clampLimit)(10)).toBe(10);
        (0, vitest_1.expect)((0, pagination_1.clampLimit)(9999)).toBe(pagination_1.MAX_LIMIT);
    });
    (0, vitest_1.it)("cursorToDate parses ISO or returns null", () => {
        (0, vitest_1.expect)((0, pagination_1.cursorToDate)(undefined)).toBeNull();
        (0, vitest_1.expect)((0, pagination_1.cursorToDate)("not-a-date")).toBeNull();
        (0, vitest_1.expect)((0, pagination_1.cursorToDate)("2026-01-01T00:00:00.000Z")?.getUTCFullYear()).toBe(2026);
    });
    (0, vitest_1.it)("buildPage emits a cursor only when there is an extra row", () => {
        const rows = [{ at: new Date("2026-01-03") }, { at: new Date("2026-01-02") }, { at: new Date("2026-01-01") }];
        const full = (0, pagination_1.buildPage)(rows, 2, (r) => r.at);
        (0, vitest_1.expect)(full.items).toHaveLength(2);
        (0, vitest_1.expect)(full.nextCursor).toBe(new Date("2026-01-02").toISOString());
        const last = (0, pagination_1.buildPage)(rows, 5, (r) => r.at);
        (0, vitest_1.expect)(last.nextCursor).toBeNull();
    });
});
//# sourceMappingURL=pagination.spec.js.map