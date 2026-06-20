import { randomBytes, createHash, randomInt } from "node:crypto";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
export function newSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: sha256(token) };
}
/** 6-digit numeric one-time code (English digits). */
export function newNumericCode(): string {
  return String(randomInt(100000, 1000000));
}
