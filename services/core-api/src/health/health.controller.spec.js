"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const health_controller_1 = require("./health.controller");
(0, vitest_1.describe)("HealthController", () => {
    (0, vitest_1.it)("liveness returns ok", () => {
        const fakeDb = { pool: { query: async () => ({}) } };
        const fakeRedis = { ping: async () => "PONG" };
        const c = new health_controller_1.HealthController(fakeDb, fakeRedis);
        (0, vitest_1.expect)(c.live().status).toBe("ok");
    });
});
//# sourceMappingURL=health.controller.spec.js.map