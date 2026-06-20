"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const crypto_1 = require("./crypto");
(0, vitest_1.describe)("auth crypto", () => {
    (0, vitest_1.it)("sha256 is deterministic", () => {
        (0, vitest_1.expect)((0, crypto_1.sha256)("hello")).toBe((0, crypto_1.sha256)("hello"));
    });
    (0, vitest_1.it)("session tokens are random and stored only as a hash", () => {
        const a = (0, crypto_1.newSessionToken)();
        const b = (0, crypto_1.newSessionToken)();
        (0, vitest_1.expect)(a.token).not.toBe(b.token);
        (0, vitest_1.expect)(a.tokenHash).toBe((0, crypto_1.sha256)(a.token));
        (0, vitest_1.expect)(a.tokenHash).not.toBe(a.token);
    });
    (0, vitest_1.it)("codes are six numeric digits", () => {
        for (let i = 0; i < 50; i++)
            (0, vitest_1.expect)((0, crypto_1.newNumericCode)()).toMatch(/^\d{6}$/);
    });
});
//# sourceMappingURL=crypto.spec.js.map