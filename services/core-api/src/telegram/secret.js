"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeEqual = safeEqual;
const node_crypto_1 = require("node:crypto");
/** Constant-time, length-guarded secret comparison (avoids timing leaks). */
function safeEqual(provided, expected) {
    if (!provided || !expected)
        return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length)
        return false;
    return (0, node_crypto_1.timingSafeEqual)(a, b);
}
//# sourceMappingURL=secret.js.map