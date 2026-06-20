"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256 = sha256;
exports.newSessionToken = newSessionToken;
exports.newNumericCode = newNumericCode;
const node_crypto_1 = require("node:crypto");
function sha256(value) {
    return (0, node_crypto_1.createHash)("sha256").update(value).digest("hex");
}
function newSessionToken() {
    const token = (0, node_crypto_1.randomBytes)(32).toString("base64url");
    return { token, tokenHash: sha256(token) };
}
/** 6-digit numeric one-time code (English digits). */
function newNumericCode() {
    return String((0, node_crypto_1.randomInt)(100000, 1000000));
}
//# sourceMappingURL=crypto.js.map