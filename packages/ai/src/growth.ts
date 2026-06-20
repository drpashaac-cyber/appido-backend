import { LiteLlmClient } from "./client";
import type { ChatUsage } from "./types";
import { modelForTask } from "./tasks";

export interface LeadScore {
  score: number; // 0..100 purchase-intent
  tier: "hot" | "warm" | "cold";
  tags: string[];
  reason: string;
}

function parseJsonObject<T>(text: string): T | null {
  const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(clean.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

const SCORE_SYSTEM =
  "You are a lead-scoring engine for a Telegram business. Given a customer profile and recent activity, " +
  "rate purchase intent 0-100 (higher = more likely to buy now) and classify. " +
  'Return ONLY compact JSON, no markdown: {"score":<0-100>,"tier":"hot|warm|cold","tags":["short","labels"],"reason":"<=140 chars"}.';

// fast tier — runs over many customers cheaply (see TASK_TIER).
export async function scoreLead(
  client: LiteLlmClient,
  input: { profile: string },
): Promise<{ result: LeadScore | null; usage?: ChatUsage; model: string }> {
  const model = modelForTask("score_lead");
  const res = await client.chat({
    model,
    messages: [
      { role: "system", content: SCORE_SYSTEM },
      { role: "user", content: input.profile },
    ],
    temperature: 0,
    max_tokens: 200,
  });
  const text = res.choices[0]?.message?.content ?? "";
  
  // --- اصلاح خط 45 شروع ---
  // اطمینان از اینکه text یک رشته است قبل از ارسال به parseJsonObject
  let raw: LeadScore | null = null;
  if (typeof text === 'string') {
    raw = parseJsonObject<LeadScore>(text);
  } else {
    // اگر text از نوع TextPart[] یا هر نوع دیگری بود، آن را به رشته تبدیل می‌کنیم
    raw = parseJsonObject<LeadScore>(JSON.stringify(text));
  }
  // --- اصلاح خط 45 پایان ---

  // --- اصلاح خط 53 (tags) شروع ---
  let safeTags: string[] = [];
  if (raw && Array.isArray(raw.tags)) {
    safeTags = raw.tags.slice(0, 8).map((x) => String(x));
  }
  // --- اصلاح خط 53 پایان ---

  const result: LeadScore | null = raw
    ? {
        score: Math.max(0, Math.min(100, Math.round(Number(raw.score) || 0))),
        tier: raw.tier === "hot" || raw.tier === "warm" ? raw.tier : "cold",
        tags: safeTags,
        reason: String(raw.reason ?? "").slice(0, 200),
      }
    : null;
  return { result, usage: res.usage, model };
}

// smart tier — campaign / retargeting copy.
export async function writeCampaign(
  client: LiteLlmClient,
  input: { goal: string; audience: string; product?: string; tone?: string; language?: string },
): Promise<{ body: string; usage?: ChatUsage; model: string }> {
  const model = modelForTask("write_campaign");
  const system =
    `You are a senior conversion copywriter for Telegram broadcasts. Write ONE message in ${input.language ?? "the audience's language"}, ` +
    `${input.tone ?? "warm and direct"} tone, under 600 characters, plain text (no markdown headers), with exactly one clear call to action. ` +
    "Output ONLY the message text.";
  const user = `Goal: ${input.goal}\nAudience: ${input.audience}${input.product ? `\nProduct: ${input.product}` : ""}`;
  const res = await client.chat({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.6,
    max_tokens: 400,
  });
  const content = res.choices[0]?.message?.content ?? "";
  
  // --- اصلاح خط 77 شروع ---
  let safeBody: string;
  if (typeof content === 'string') {
    safeBody = content.trim();
  } else {
    safeBody = JSON.stringify(content).trim();
  }
  // --- اصلاح خط 77 پایان ---

  return { body: safeBody, usage: res.usage, model };
}