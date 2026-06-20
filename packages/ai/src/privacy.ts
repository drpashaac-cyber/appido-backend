// PII redaction applied BEFORE customer text is sent to a third-party LLM (and optionally at rest).
// Conservative by design — it favors over-masking to avoid leaking personal data to the model provider.
// Modes: "off" (no change) | "mask_before_llm" | "mask_at_rest". Both masking modes use redactPII().

export type PiiMode = "off" | "mask_before_llm" | "mask_at_rest";

const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const CARD = /\b(?:\d[ -]?){13,19}\b/g; // card-like sequences (13–19 digits, optional spaces/dashes)
const PHONE = /\+?\d[\d\s().-]{7,}\d/g; // phone-like (9+ chars incl. separators)
const LONGNUM = /\b\d{9,}\b/g; // long id-like numbers (national id, account, etc.)

/** Returns text with emails, card-like numbers, phone-like numbers, and long id numbers masked. */
export function redactPII(text: string): string {
  if (!text) return text;
  return text
    .replace(EMAIL, "[email]")
    .replace(CARD, "[card]")
    .replace(PHONE, "[phone]")
    .replace(LONGNUM, "[number]");
}

/** Applies redaction only when the mode masks before the LLM (covers mask_before_llm and mask_at_rest). */
export function redactForLlm(text: string, mode: PiiMode): string {
  return mode === "off" ? text : redactPII(text);
}
