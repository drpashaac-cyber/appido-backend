import { describe, it, expect } from "vitest";
import { chunkText } from "./chunking";
import { resolveModel, estimateCostMicroUsd, isAiModel, routeModel, REGION_MODELS } from "./models";
import { buildSystemPrompt, BASE_GUARDRAILS } from "./prompt";
import { redactPII, redactForLlm } from "./privacy";
import { TOOL_SPECS } from "./tool-specs";

describe("ai core (pure)", () => {
  it("chunks long text with overlap and trims short text", () => {
    expect(chunkText("  hello   world  ")).toEqual(["hello world"]);
    const long = "a ".repeat(1200);
    const chunks = chunkText(long, 1000, 150);
    expect(chunks.length).toBeGreaterThan(1);
  });
  it("resolves models and defaults unknown to claude", () => {
    expect(resolveModel("gpt")).toBe("gpt");
    expect(resolveModel("bogus")).toBe("claude");
    expect(isAiModel("gemini")).toBe(true);
  });
  it("estimates cost monotonically in tokens", () => {
    const a = estimateCostMicroUsd("claude", 1000, 1000);
    const b = estimateCostMicroUsd("claude", 2000, 2000);
    expect(b).toBeGreaterThan(a);
  });
  it("system prompt always carries the safety guardrails", () => {
    const sys = buildSystemPrompt({ tenantName: "Acme", goal: "convert", tone: "friendly", languages: ["en", "fa"] });
    expect(sys).toContain(BASE_GUARDRAILS);
    expect(sys).toContain("Acme");
  });
  it("system prompt includes the onboarding playbook when provided", () => {
    const sys = buildSystemPrompt({ tenantName: "Acme", onboarding: [{ key: "use_case", question: "What do you sell?" }] });
    expect(sys).toContain(BASE_GUARDRAILS); // additive, never overrides safety
    expect(sys).toContain("use_case");
    expect(sys).toContain("record_lead_answer");
  });
  it("exposes the Action Registry tools including record_lead_answer and set_consent", () => {
    const names = TOOL_SPECS.map((t) => t.function.name);
    expect(names).toEqual([
      "get_product", "search_knowledge", "create_checkout_link",
      "grant_access", "tag_customer", "set_intent", "escalate",
      "record_lead_answer", "set_consent",
    ]);
  });
  it("emits the consent gate only when AI consent is required", () => {
    const without = buildSystemPrompt({ tenantName: "Acme" });
    expect(without).not.toContain("Consent gate");
    const withGate = buildSystemPrompt({ tenantName: "Acme", requireAiConsent: true });
    expect(withGate).toContain("Consent gate");
    expect(withGate).toContain("set_consent");
    expect(withGate).toContain(BASE_GUARDRAILS);
  });
  it("redacts PII but keeps short business numbers", () => {
    const out = redactPII("mail a@b.com, call +98 912 345 6789, I want 2 for $179");
    expect(out).not.toContain("a@b.com");
    expect(out).toContain("[email]");
    expect(out).toContain("2");
    expect(out).toContain("$179");
    expect(redactForLlm("a@b.com", "off")).toBe("a@b.com"); // off = pass-through
    expect(redactForLlm("a@b.com", "mask_before_llm")).toContain("[email]");
  });
  it("residency routing is a pass-through until a region model is configured", () => {
    expect(routeModel("claude", "global")).toBe("claude");
    expect(routeModel("claude", "eu")).toBe("claude"); // no override registered
    REGION_MODELS["eu:claude"] = "claude-eu";
    expect(routeModel("claude", "eu")).toBe("claude-eu");
    delete REGION_MODELS["eu:claude"];
  });
});
