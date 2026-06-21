import { timingSafeEqual } from "node:crypto";

/** Constant-time, length-guarded secret comparison (avoids timing leaks). */
export function safeEqual(provided: string | undefined, expected: string | null): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
