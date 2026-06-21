import { describe, it, expect } from "vitest";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  it("liveness returns ok", () => {
    const fakeDb = { pool: { query: async () => ({}) } } as never;
    const fakeRedis = { ping: async () => "PONG" } as never;
    const c = new HealthController(fakeDb, fakeRedis);
    expect(c.live().status).toBe("ok");
  });
});
