import { modelForTier, type ModelTier } from "./models";

// Every AI use across Appido is a named task that declares the cost tier it runs on,
// so routing/cost policy lives in ONE place. Tenant-facing chat uses the tenant's chosen
// model; internal/batch tasks default to the cheap `fast` tier.
export const AI_TASKS = [
  "chat",
  "reply",
  "advisor",
  "write_campaign",
  "score_lead",
  "tag",
  "segment",
  "find_leads",
  "retarget",
] as const;
export type AiTaskName = (typeof AI_TASKS)[number];

export const TASK_TIER: Record<AiTaskName, ModelTier> = {
  chat: "smart",
  reply: "fast",
  advisor: "smart",
  write_campaign: "smart",
  score_lead: "fast",
  tag: "fast",
  segment: "fast",
  find_leads: "fast",
  retarget: "fast",
};

export function modelForTask(task: AiTaskName): string {
  return modelForTier(TASK_TIER[task]);
}

// Hybrid customer-reply routing (token-burn control). Routine, high-volume replies run on the cheap/
// local `fast` tier; only high-intent or VIP customers escalate to the tenant's `smart` model. This
// is what keeps "AI handles every customer automatically" economically viable at scale — the same
// local/cloud split the owner console reports on.
export const REPLY_ESCALATE_INTENT = 60;
export function replyRoute(input: { intent?: number | null; isVip?: boolean | null }): { tier: ModelTier; task: AiTaskName } {
  const escalate = (input.isVip ?? false) || (input.intent ?? 0) >= REPLY_ESCALATE_INTENT;
  return escalate ? { tier: "smart", task: "chat" } : { tier: "fast", task: "reply" };
}
