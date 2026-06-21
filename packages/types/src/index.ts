// Shared cross-surface types. Grows in P2 to match the Api contract the
// dashboard + owner console consume (replacing their MockApi).

export type Lang = "en" | "fa" | "ar" | "tr" | "ru";
export type Theme = "light" | "dark";

// Platform (owner-console) operator roles + tenant (dashboard) roles.
export type PlatformRole = "owner" | "manager" | "marketer" | "finance" | "support" | "trust";
export type TenantRole = "tenant_admin" | "tenant_member";
export type Role = PlatformRole | TenantRole;

export const PLATFORM_ROLES: PlatformRole[] = ["owner", "manager", "marketer", "finance", "support", "trust"];
export const isPlatformRole = (r: Role): r is PlatformRole => (PLATFORM_ROLES as string[]).includes(r);

export type LoginMethod = "password" | "code";

export interface Me {
  id: string;
  email: string;
  name: string;
  role: Role;
  tenantId: string | null;
  mustRotate: boolean;
}

export interface SessionInfo {
  authenticated: boolean;
  expiresAt?: string;
  impersonating?: boolean;
}

/** Row-level-security context applied per request. */
export interface RlsContext {
  platform: boolean;
  tenantId?: string | null;
}

/** Realtime event envelope pushed over SSE / WebSocket (Redis pub/sub backed). */
export interface RealtimeEvent<T = unknown> {
  type: string;
  tenantId: string;
  at: string;
  payload: T;
}

export interface ApiOk<T> { ok: true; data: T; }
export interface ApiErr { ok: false; error: string; code?: string; }
export type ApiResult<T> = ApiOk<T> | ApiErr;

/**
 * Event taxonomy is an OPEN registry — the events store is the analytics + future
 * workflow-trigger backbone. New types are added here with NO migration, because
 * events.type is stored as text. These are the well-known core types.
 */
export const EVENT_TYPES = [
  "joined", "viewed", "message",
  "paid", "failed", "refunded",
  "renewed", "expired",
  "vip", "lead_scored",
  "campaign_sent", "campaign_opened", "link_clicked",
  "access_granted", "access_revoked",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];
