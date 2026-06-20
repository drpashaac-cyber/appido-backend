import { describe, it, expect } from "vitest";
import { can, permissionsForRole, PERMISSIONS } from "./permissions";

describe("authz", () => {
  it("owner has the full catalog", () => {
    expect(permissionsForRole("owner")).toHaveLength(PERMISSIONS.length);
  });
  it("tenant_admin can configure; tenant_member cannot", () => {
    expect(can({ role: "tenant_admin" }, "payments:configure")).toBe(true);
    expect(can({ role: "tenant_member" }, "payments:configure")).toBe(false);
  });
  it("tenant_member can view but NOT export customers (ABAC-style granularity)", () => {
    expect(can({ role: "tenant_member" }, "customers:read")).toBe(true);
    expect(can({ role: "tenant_member" }, "customers:export")).toBe(false);
  });
  it("tenant scoping: a tenant admin cannot act on another tenant's resource", () => {
    const actor = { role: "tenant_admin" as const, tenantId: "A" };
    expect(can(actor, "customers:read", { tenantId: "A" })).toBe(true);
    expect(can(actor, "customers:read", { tenantId: "B" })).toBe(false);
  });
  it("platform roles bypass tenant scoping", () => {
    expect(can({ role: "support", tenantId: null }, "customers:read", { tenantId: "B" })).toBe(true);
  });
});
