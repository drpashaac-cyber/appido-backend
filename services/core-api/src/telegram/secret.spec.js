"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const secret_1 = require("./secret");
(0, vitest_1.describe)("safeEqual (webhook secret verification)", () => {
    (0, vitest_1.it)("accepts an exact match", () => {
        (0, vitest_1.expect)((0, secret_1.safeEqual)("s3cr3t-token", "s3cr3t-token")).toBe(true);
    });
    (0, vitest_1.it)("rejects a mismatch", () => {
        (0, vitest_1.expect)((0, secret_1.safeEqual)("s3cr3t-token", "wrong-token!!")).toBe(false);
    });
    (0, vitest_1.it)("rejects differing lengths without throwing", () => {
        (0, vitest_1.expect)((0, secret_1.safeEqual)("short", "a-much-longer-secret")).toBe(false);
    });
    (0, vitest_1.it)("rejects missing values", () => {
        (0, vitest_1.expect)((0, secret_1.safeEqual)(undefined, "x")).toBe(false);
        (0, vitest_1.expect)((0, secret_1.safeEqual)("x", null)).toBe(false);
    });
});
//# sourceMappingURL=secret.spec.js.map