import { describe, expect, it } from "vitest";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  it("returns a live status with an ISO timestamp", () => {
    const fakeDb = { pool: { query: async () => ({}) } } as never;
    const controller = new HealthController(fakeDb);

    const result = controller.live();

    expect(result.status).toBe("ok");
    expect(new Date(result.ts).toISOString()).toBe(result.ts);
  });
});
