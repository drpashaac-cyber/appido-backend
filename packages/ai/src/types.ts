export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}
/** A cacheable text part (Anthropic prompt caching, passed through by LiteLLM). */
export interface TextPart {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}
export interface ChatMessage {
  role: ChatRole;
  content: string | TextPart[] | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}
export interface ToolSpec {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}
export interface ChatUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}
export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  tools?: ToolSpec[];
  tool_choice?: "auto" | "none";
  temperature?: number;
  max_tokens?: number;
  user?: string;
  metadata?: Record<string, unknown>;
}
export interface ChatResponse {
  choices: { message: ChatMessage; finish_reason: string }[];
  usage?: ChatUsage;
  model?: string;
}
