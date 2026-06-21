import { isPlatformRole, type Role } from "@appido/types";

/**
 * Capability catalog for a Business OS (not a CRM). Call sites ask `can(...)`
 * against these, never a raw role — so finer policy lands without touching them.
 */
export const PERMISSIONS = [
  // platform (owner console)
  "platform:overview",
  "tenants:read",
  "tenants:manage",
  "billing:read", // Appido MRR / subscriptions
  "billing:manage",
  "users:manage", // owner-side staff
  "audit:read",
  "trust:review",
  // tenant workspace (dashboard)
  "customers:read",
  "customers:write",
  "customers:export",
  "products:read",
  "products:write",
  "transactions:read",
  "inbox:read",
  "inbox:reply",
  "telegram:connect",
  "payments:configure",
  "ai:configure",
  "broadcast:send",
  "analytics:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const TENANT_FULL: Permission[] = [
  "customers:read",
  "customers:write",
  "customers:export",
  "products:read",
  "products:write",
  "transactions:read",
  "inbox:read",
  "inbox:reply",
  "telegram:connect",
  "payments:configure",
  "ai:configure",
  "broadcast:send",
  "analytics:read",
];

// e.g. a tenant member can view but NOT export customers / configure connectors.
const TENANT_READONLY: Permission[] = [
  "customers:read",
  "products:read",
  "transactions:read",
  "inbox:read",
  "inbox:reply",
  "analytics:read",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // platform operators
  owner: [...PERMISSIONS],
  manager: [
    "platform:overview",
    "tenants:read",
    "tenants:manage",
    "users:manage",
    "audit:read",
    "analytics:read",
    "customers:read",
    "transactions:read",
  ],
  marketer: ["analytics:read", "broadcast:send", "customers:read"],
  finance: ["platform:overview", "billing:read", "billing:manage", "transactions:read", "analytics:read"],
  support: ["tenants:read", "customers:read", "inbox:read", "inbox:reply"],
  trust: ["trust:review", "audit:read", "tenants:read", "customers:read"],
  // tenant workspace
  tenant_admin: TENANT_FULL,
  tenant_member: TENANT_READONLY,
};

export function permissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export interface AuthzActor {
  role: Role;
  tenantId?: string | null;
}
export interface AuthzResource {
  tenantId?: string | null;
}

/**
 * Capability check. RBAC today (role → permission set). The `resource` arg is the
 * ABAC seam: tenant-scoped actors may only act within their own tenant, and richer
 * attribute conditions slot in here later without changing any call site.
 */
export function can(actor: AuthzActor, permission: Permission, resource?: AuthzResource): boolean {
  if (!permissionsForRole(actor.role).includes(permission)) return false;
  if (
    resource?.tenantId != null &&
    actor.tenantId != null &&
    resource.tenantId !== actor.tenantId &&
    !isPlatformRole(actor.role)
  ) {
    return false;
  }
  return true;
}
