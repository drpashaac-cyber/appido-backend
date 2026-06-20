import { eq } from "drizzle-orm";
import type { Pool } from "pg";
import { runWithRls, schema } from "@appido/db";
import { LiteLlmClient } from "./client";
import { modelForTier } from "./models";

export interface EvalSummary {
  id?: string;
  task: string;
  total: number;
  passed: number;
  avgScore: number;
}

const JUDGE_SYSTEM =
  "You are a strict evaluator. Given INPUT, the MODEL OUTPUT, and the EXPECTED answer/criteria, " +
  "score how well the output meets the expectation from 0 to 100. " +
  'Return ONLY JSON: {"score":<0-100>,"pass":<true|false>}. Set pass=true only if score>=70.';

function parseScore(text: string): { score: number; pass: boolean } {
  const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = clean.indexOf("{");
  const b = clean.lastIndexOf("}");
  if (a === -1 || b === -1) return { score: 0, pass: false };
  try {
    const o = JSON.parse(clean.slice(a, b + 1)) as { score?: number; pass?: boolean };
    const score = Math.max(0, Math.min(100, Math.round(Number(o.score) || 0)));
    return { score, pass: o.pass === true || score >= 70 };
  } catch {
    return { score: 0, pass: false };
  }
}

// Generic regression eval: run each golden case through the model, then an LLM judge (smart
// tier) scores the output against the expected answer. Persists an eval_runs row. This is the
// "measure" + "promote-gated" foundation — a candidate is promoted only if it beats current.
export async function runEval(
  pool: Pool,
  client: LiteLlmClient,
  opts: { task: string; model?: string; judgeModel?: string },
): Promise<EvalSummary> {
  const cases = await runWithRls(pool, { platform: true }, (tx) =>
    tx.select().from(schema.goldenCases).where(eq(schema.goldenCases.task, opts.task)).limit(200),
  );
  if (cases.length === 0) return { task: opts.task, total: 0, passed: 0, avgScore: 0 };

  const model = opts.model ?? modelForTier("smart");
  const judgeModel = opts.judgeModel ?? modelForTier("smart");
  let totalScore = 0;
  let passed = 0;
  const detail: Record<string, unknown>[] = [];

  for (const gc of cases) {
    const output = await client
      .chat({ model, messages: [{ role: "user", content: gc.input }], temperature: 0, max_tokens: 400 })
      .then((r) => r.choices[0]?.message?.content ?? "")
      .catch(() => "");
    const verdict = await client
      .chat({
        model: judgeModel,
        messages: [
          { role: "system", content: JUDGE_SYSTEM },
          { role: "user", content: `INPUT:\n${gc.input}\n\nMODEL OUTPUT:\n${output}\n\nEXPECTED:\n${gc.expected}` },
        ],
        temperature: 0,
        max_tokens: 60,
      })
      .then((r) => r.choices[0]?.message?.content ?? "")
      .catch(() => "");
    
    // --- اصلاح خط 70 (و 71-72) شروع ---
    // اطمینان از اینکه محتوای verdict یک رشته است، اگر نباشد، آن را به رشته تبدیل می‌کنیم.
    let verdictContent: string;
    if (typeof verdict === 'string') {
      verdictContent = verdict;
    } else {
      // اگر verdict از نوع TextPart[] یا هر نوع دیگری بود، با JSON.stringify آن را به یک رشته تبدیل می‌کنیم.
      verdictContent = JSON.stringify(verdict);
    }
    // --- اصلاح خط 70 (و 71-72) پایان ---

    const { score, pass } = parseScore(verdictContent);
    totalScore += score;
    if (pass) passed++;
    detail.push({ id: gc.id, score, pass });
  }

  const avgScore = Math.round(totalScore / cases.length);
  const [run] = await runWithRls(pool, { platform: true }, (tx) =>
    tx.insert(schema.evalRuns).values({ task: opts.task, model, total: cases.length, passed, avgScore, detail }).returning({ id: schema.evalRuns.id }),
  );
  return { id: run.id, task: opts.task, total: cases.length, passed, avgScore };
}