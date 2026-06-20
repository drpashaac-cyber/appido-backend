import { describe, it, expect } from "vitest";
import { SecretCipher, buildKeyList } from "./index";

describe("SecretCipher", () => {
  const cipher = new SecretCipher("test-master-key-at-least-32-chars-xx");
  it("round-trips a secret", () => {
    const secret = "123456789:AAExampleBotTokenValue_30chars-long";
    expect(cipher.decrypt(cipher.encrypt(secret))).toBe(secret);
  });
  it("produces different ciphertext each time (random IV)", () => {
    expect(cipher.encrypt("x")).not.toBe(cipher.encrypt("x"));
  });
  it("rejects tampered ciphertext", () => {
    const enc = cipher.encrypt("secret");
    const parts = enc.split(":");
    parts[3] = Buffer.from("tampered").toString("base64");
    expect(() => cipher.decrypt(parts.join(":"))).toThrow();
  });
  it("requires a strong master key", () => {
    expect(() => new SecretCipher("short")).toThrow();
  });
});

describe("SecretCipher key rotation", () => {
  const OLD = "old-key-old-key-old-key-old-key-32x";
  const NEW = "new-key-new-key-new-key-new-key-32x";

  it("decrypts ciphertext from an old key when the new key is primary", () => {
    const oldCipher = new SecretCipher(OLD);
    const blob = oldCipher.encrypt("secret-token");
    const rotated = new SecretCipher([NEW, OLD]); // new primary, old fallback
    expect(rotated.decrypt(blob)).toBe("secret-token");
  });

  it("reEncrypt migrates an old blob to the primary key", () => {
    const oldCipher = new SecretCipher(OLD);
    const blob = oldCipher.encrypt("secret-token");
    const rotated = new SecretCipher([NEW, OLD]);
    const migrated = rotated.reEncrypt(blob);
    expect(migrated).not.toBeNull();
    expect(new SecretCipher(NEW).decrypt(migrated as string)).toBe("secret-token");
    // already-current blob needs no re-encryption
    expect(rotated.reEncrypt(migrated as string)).toBeNull();
  });

  it("buildKeyList keeps only >=32-char keys, primary first", () => {
    expect(buildKeyList(NEW, `${OLD}, short`)).toEqual([NEW, OLD]);
    expect(buildKeyList(undefined, undefined)).toEqual([]);
  });
});
