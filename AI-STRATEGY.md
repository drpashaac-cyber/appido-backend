# Appido AI Strategy — cost, ownership & the data moat

**Decision (P-team):** ship **Managed Hybrid** now. Route across *hosted* models through
the LiteLLM gateway — frontier models for hard reasoning, a cheap/fast model for
high-volume simple tasks — plus caching + RAG. **No self-hosted GPUs yet.** Self-hosting
and fine-tuning are deferred behind a measured volume trigger. The gateway makes the
later switch a one-line config change, not a rewrite.

## Why (against the founder's constraints)
- **Low ops burden** — zero GPUs, no serving stack, no 24/7 on-call. Just gateway config.
- **Competitive** — frontier models (Claude/GPT/Gemini) wherever quality matters.
- **Lower token cost now** — ~80% of volume (intent, tag, lead-score, segment, lead-find,
  campaign copy) runs on the cheap `fast` tier; prompt + semantic caching makes repeats
  near-free; RAG removes the need to fine-tune to "know" the business.
- **Honest economics** — self-host only beats hosted API above ~5M tokens/day (single
  host) / ~30–50M/day (multi-node MoE). Below that, API wins once ops time is priced in.

## "Gets smarter every day" — the SAFE automatic loop (not live self-retraining)
A model rewriting its own weights live, unsupervised, is unsafe (drift, sudden
regressions). Instead, an **eval-gated improvement loop**:
1. **Collect** — every AI call + outcome (paid / churn / escalate / human-override) is
   logged (`ai_usage` now carries `task`, `tier`, `latency_ms`, `outcome`).
2. **Learn without retraining** — best-converting conversations become few-shot examples;
   the tenant knowledge base grows; routing/cache tune themselves on real traffic.
3. **Measure** — golden eval sets per task score quality over time.
4. **Promote (gated)** — periodically a candidate (better prompt, or later a distilled
   small model) is built automatically and **only promoted if it beats the current one on
   evals.** A bad candidate never ships.

## Tiers (one place for cost policy)
| Tier   | Use                                            | Model (LiteLLM `model_name`) |
|--------|------------------------------------------------|------------------------------|
| `smart`| customer chat reasoning, advisor, campaign copy| frontier (claude/gpt/gemini) |
| `fast` | intent, tag, lead-score, segment, lead-find    | cheap fast hosted model      |
| `embed`| RAG embeddings                                 | text-embedding-3-small       |

Tenant-facing chat uses the **tenant's chosen** model; internal/batch tasks default to
`fast`. Defined as `AiTask` + `TASK_TIER` in `@appido/ai`.

## Staged roadmap (each stage has a numeric trigger; decided on real `ai_usage` data)
- **Stage 0 — now (Managed Hybrid):** tiered routing + caching + RAG + flywheel logging.
- **Stage 1 — self-host the cheap, high-volume layer:** when embeddings or `fast`-tier
  volume is sustained and the math flips, run **embeddings + a small open model**
  (e.g. Qwen3-27B/Gemma 4 on a single GPU via vLLM/Ollama) behind the gateway. Frontier
  chat stays on API. One config line; no app change.
- **Stage 2 — distill domain models:** with enough labeled data, distill frontier
  behavior per task into small models (smaller base ⇒ fast fine-tune cycles, cheap infra,
  strong on narrow tasks). Eval-gated, offline.
- **Stage 3 — fine-tune / dedicated models per domain or per large tenant.**

> Operating a self-hosted stack is a year-long engineering investment (multi-node serving,
> quantization, eval pipelines, on-call). We pay that cost only once the volume math and
> the strategy clearly justify it.

## Status — P7: the loop is now closed
- **Collect** ✓ `ai_usage` carries task/tier/latency_ms/outcome.
- **Attribute** ✓ nightly idempotent job credits real `paid` outcomes back to the AI
  interactions that preceded them (`outcome='converted'`), labels aged non-conversions
  (`no_conversion`), and marks converting `campaign_sends`. → a real labeled dataset.
- **Measure** ✓ generic eval-runner scores the model against owner-curated `golden_cases`
  via an LLM judge, persisting `eval_runs` (regression tracking + promote-gate input).
- **Promote (gated)** — still manual/eval-gated by design; a candidate prompt/model is
  adopted only after it beats current on evals. No live self-retraining (safety).
- Next (data-dependent): few-shot mining of converting interactions from `messages`;
  churn attribution once per-customer access-expiry events exist; auto-promotion gate.
