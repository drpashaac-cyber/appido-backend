export const AI_MODELS = ["claude", "gpt", "gemini"] as const;
export type AiModel = (typeof AI_MODELS)[number];

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

export function isAiModel(m: string): m is AiModel {
  return (AI_MODELS as readonly string[]).includes(m);
}
/** LiteLLM model_name routing — must match infra/litellm/config.yaml model_name keys. */
export function resolveModel(m: string | null | undefined): AiModel {
  return m && isAiModel(m) ? m : "claude";
}

// Rough blended price estimates (micro-USD per 1K tokens). Exact spend should come
// from LiteLLM; these only drive our own per-tenant budget guardrail.
const PRICE_PER_1K: Record<AiModel, { in: number; out: number }> = {
  claude: { in: 3000, out: 15000 },
  gpt: { in: 2000, out: 8000 },
  gemini: { in: 1250, out: 5000 },
};
export function estimateCostMicroUsd(model: AiModel, promptTokens: number, completionTokens: number): number {
  const p = PRICE_PER_1K[model];
  return Math.ceil((promptTokens / 1000) * p.in + (completionTokens / 1000) * p.out);
}

export type ModelTier = "fast" | "smart" | "embed";

// Tier → LiteLLM model_name (must match infra/litellm/config.yaml). One place for the
// cost/quality routing policy. `smart` = frontier; `fast` = cheap high-volume model.
export const TIER_MODELS: Record<ModelTier, string> = {
  fast: "fast",
  smart: "claude",
  embed: EMBEDDING_MODEL,
};
export function modelForTier(tier: ModelTier): string {
  return TIER_MODELS[tier];
}

// ---- Residency seam ----
// Optional region-specific LiteLLM model_name overrides, e.g. { "eu:claude": "claude-eu" }.
// EMPTY by default. True data residency also requires infra (regional LiteLLM deployments + regional
// DB/queues) — this map is only the app-layer routing point. Populate it (or load it from infra config)
// to send a region's LLM calls to a region-appropriate endpoint. Metering still uses the base model price.
export const REGION_MODELS: Record<string, string> = {};

/** Maps a base LiteLLM model_name to its region-specific variant when one is configured; else pass-through. */
export function routeModel(model: string, region?: string | null): string {
  if (region && region !== "global") {
    const override = REGION_MODELS[`${region}:${model}`];
    if (override) return override;
  }
  return model;
}
