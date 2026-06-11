import { describe, it, expect } from "vitest";
import { encryptField, decryptField } from "@/lib/crypto/fields";

describe("field encryption (AES-256-GCM)", () => {
  it("roundtrips a license number", () => {
    const stored = encryptField("AUA-1234567");
    expect(decryptField(stored)).toBe("AUA-1234567");
  });

  it("roundtrips unicode and empty strings", () => {
    expect(decryptField(encryptField(""))).toBe("");
    expect(decryptField(encryptField("Børge Ñandú 1990-05-17"))).toBe("Børge Ñandú 1990-05-17");
  });

  it("produces a different ciphertext every time (random IV)", () => {
    const a = encryptField("same-plaintext");
    const b = encryptField("same-plaintext");
    expect(a.equals(b)).toBe(false);
  });

  it("rejects a tampered ciphertext byte", () => {
    const stored = encryptField("AUA-1234567");
    stored[stored.length - 1] = stored[stored.length - 1]! ^ 0xff;
    expect(() => decryptField(stored)).toThrow();
  });

  it("rejects a tampered auth tag", () => {
    const stored = encryptField("AUA-1234567");
    stored[1 + 12] = stored[1 + 12]! ^ 0xff; // first tag byte
    expect(() => decryptField(stored)).toThrow();
  });

  it("rejects an unknown version", () => {
    const stored = encryptField("AUA-1234567");
    stored[0] = 9;
    expect(() => decryptField(stored)).toThrow(/version/i);
  });
});
