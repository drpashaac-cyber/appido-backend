import type { LiteLlmClient } from "./client";
import type { ChatMessage, ChatUsage } from "./types";
import { TOOL_SPECS } from "./tool-specs";
import { executeTool, type ToolContext } from "./tools";

export interface AgentResult {
  text: string;
  usage: ChatUsage;
  steps: number;
}

/**
 * Logical model names (LiteLLM `model_name`) that resolve to Anthropic models in
 * infra/litellm/config.yaml. Only these honor cache_control on the system prompt; other providers
 * (gpt/gemini) receive a plain string so they never reject the structured content. Keep in sync with
 * the gateway config if you remap a name to a different provider.
 */
const ANTHROPIC_BACKED = new Set(["claude", "claude-opus", "fast"]);

/** Runs the tool-using agent to a final text answer (bounded by maxSteps). */
export async function runAgent(input: {
  client: LiteLlmClient;
  model: string;
  system: string;
  history: ChatMessage[];
  ctx: ToolContext;
  maxSteps?: number;
}): Promise<AgentResult> {
  // Cache the long, stable system/guardrail prefix on Anthropic models (cuts cost + latency per turn).
  const systemMsg: ChatMessage = ANTHROPIC_BACKED.has(input.model)
    ? { role: "system", content: [{ type: "text", text: input.system, cache_control: { type: "ephemeral" } }] }
    : { role: "system", content: input.system };
  const messages: ChatMessage[] = [systemMsg, ...input.history];
  const usage: ChatUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  const maxSteps = input.maxSteps ?? 4;

  for (let step = 1; step <= maxSteps; step++) {
    const res = await input.client.chat({
      model: input.model,
      messages,
      tools: TOOL_SPECS,
      tool_choice: "auto",
      user: input.ctx.customerId ?? undefined,
      metadata: { tenant_id: input.ctx.tenantId },
    });
    if (res.usage) {
      usage.prompt_tokens += res.usage.prompt_tokens;
      usage.completion_tokens += res.usage.completion_tokens;
      usage.total_tokens += res.usage.total_tokens;
    }
    const msg = res.choices[0]?.message;
    if (!msg) break;

    if (msg.tool_calls?.length) {
      messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });
      for (const call of msg.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          args = {};
        }
        const result = await executeTool(call.function.name, args, input.ctx);
        messages.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content: JSON.stringify(result) });
      }
      continue;
    }
    return { text: typeof msg.content === "string" ? msg.content : "", usage, steps: step };
  }
  return { text: "", usage, steps: maxSteps };
}
