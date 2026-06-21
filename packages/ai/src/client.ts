import { EMBEDDING_MODEL } from "./models";
import type { ChatRequest, ChatResponse, ChatUsage } from "./types";

/** OpenAI-compatible client pointed at the LiteLLM gateway. */
export class LiteLlmClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  private headers(): Record<string, string> {
    return { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` };
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ temperature: 0.3, ...req }),
    });
    if (!res.ok) throw new Error(`litellm chat ${res.status}: ${await res.text().catch(() => "")}`);
    return (await res.json()) as ChatResponse;
  }

  async embed(input: string[], model: string = EMBEDDING_MODEL): Promise<{ embeddings: number[][]; usage?: ChatUsage }> {
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ model, input }),
    });
    if (!res.ok) throw new Error(`litellm embed ${res.status}: ${await res.text().catch(() => "")}`);
    const json = (await res.json()) as { data: { embedding: number[] }[]; usage?: ChatUsage };
    return { embeddings: json.data.map((d) => d.embedding), usage: json.usage };
  }
}
