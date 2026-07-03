import { EMBEDDING_MODEL } from "./models";

export class LiteLlmClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) {}

  async chat(input: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
    [key: string]: unknown;
  }): Promise<any> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(input),
    });
    if (!response.ok) return undefined;
    return response.json();
  }

  async embed(input: string[]): Promise<{ embeddings: number[][] }> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`litellm_embedding_failed:${response.status}:${body.slice(0, 500)}`);
    }

    const payload = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
      embeddings?: number[][];
    };

    const embeddings = Array.isArray(payload.embeddings)
      ? payload.embeddings
      : Array.isArray(payload.data)
        ? payload.data.map((item) => item.embedding)
        : [];

    if (embeddings.length !== input.length || embeddings.some((embedding) => !Array.isArray(embedding))) {
      throw new Error("litellm_embedding_invalid_response");
    }

    return { embeddings: embeddings as number[][] };
  }
}