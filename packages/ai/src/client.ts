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
}
