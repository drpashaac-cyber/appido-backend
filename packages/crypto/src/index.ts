import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// Authenticated encryption (AES-256-GCM) for secrets at rest: tenant gateway keys
// and Telegram bot tokens. Ciphertext is self-describing & tamper-evident:
//   v1:<base64 iv>:<base64 authTag>:<base64 ciphertext>
//
// Key rotation (no downtime): construct with [newPrimaryKey, ...oldKeys]. Encryption always
// uses the primary key; decryption tries every key (a wrong key fails the GCM auth tag, so we
// fall through). Re-encrypt rows lazily (on next write) or run a sweep via reEncrypt(), then
// drop the old key. This is also the envelope-encryption seam: swap the constructor to unwrap
// a DEK from a KMS (AWS KMS / GCP KMS / Vault); the encrypt/decrypt format stays stable.
const VERSION = "v1";
const KDF_SALT = "appido.secret.kdf.v1";

export class SecretCipher {
  private readonly keys: Buffer[]; // keys[0] = primary (encrypt); all are tried on decrypt

  constructor(masterKey: string | string[]) {
    const list = (Array.isArray(masterKey) ? masterKey : [masterKey]).filter((k) => typeof k === "string" && k.length >= 32);
    if (list.length === 0) throw new Error("SECRETS_MASTER_KEY must be at least 32 characters");
    this.keys = list.map((k) => scryptSync(k, KDF_SALT, 32));
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.keys[0], iv);
    const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
  }

  private decryptWith(key: Buffer, ivB: string, tagB: string, ctB: string): string {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB, "base64"));
    decipher.setAuthTag(Buffer.from(tagB, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ctB, "base64")), decipher.final()]).toString("utf8");
  }

  decrypt(ciphertext: string): string {
    const [v, ivB, tagB, ctB] = ciphertext.split(":");
    if (v !== VERSION || !ivB || !tagB || !ctB) throw new Error("malformed ciphertext");
    for (const key of this.keys) {
      try {
        return this.decryptWith(key, ivB, tagB, ctB);
      } catch {
        // wrong key → GCM auth tag mismatch → try the next (supports rotation)
      }
    }
    throw new Error("decryption failed: no matching key");
  }

  private underPrimary(ivB: string, tagB: string, ctB: string): boolean {
    try {
      this.decryptWith(this.keys[0], ivB, tagB, ctB);
      return true;
    } catch {
      return false;
    }
  }

  /** Re-encrypt under the current primary key. Returns null if already current (no change). */
  reEncrypt(ciphertext: string): string | null {
    const [v, ivB, tagB, ctB] = ciphertext.split(":");
    if (v !== VERSION || !ivB || !tagB || !ctB) throw new Error("malformed ciphertext");
    if (this.underPrimary(ivB, tagB, ctB)) return null;
    return this.encrypt(this.decrypt(ciphertext));
  }
}

/** Build the cipher key list from env: primary first, then comma-separated old keys. */
export function buildKeyList(primary: string | undefined, extra?: string): string[] {
  return [primary, ...(extra ? extra.split(",") : [])].map((k) => (k ?? "").trim()).filter((k) => k.length >= 32);
}
