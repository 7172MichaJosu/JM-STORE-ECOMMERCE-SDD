import { describe, expect, it } from "vitest";
import { decryptSessionToken, encryptSessionToken } from "../../src/security/token-vault.js";

describe("Firebase session token vault", () => {
  it("encrypts tokens with AES-GCM and detects tampering or a wrong key", async () => {
    const key = "ab".repeat(32), otherKey = "cd".repeat(32);
    const envelope = await encryptSessionToken("synthetic-refresh-token", key);
    expect(envelope).not.toContain("synthetic-refresh-token");
    await expect(decryptSessionToken(envelope, key)).resolves.toBe("synthetic-refresh-token");
    await expect(decryptSessionToken(envelope, otherKey)).rejects.toBeDefined();
    const [iv, encrypted] = envelope.split(".");
    await expect(decryptSessionToken(`${iv}.${encrypted.slice(0, -1)}A`, key)).rejects.toBeDefined();
  });
  it("rejects weak keys and malformed envelopes", async () => {
    await expect(encryptSessionToken("x", "1234")).rejects.toThrow();
    await expect(decryptSessionToken("malformed", "ab".repeat(32))).rejects.toThrow();
  });
  it("isolates rotated keys, preserves fresh IVs and rejects oversized AES keys", async () => {
    const original = "12".repeat(32), rotated = "34".repeat(32);
    const first = await encryptSessionToken("same-token", original);
    const second = await encryptSessionToken("same-token", original);
    expect(first).not.toBe(second);
    await encryptSessionToken("new-token", rotated);
    await expect(decryptSessionToken(first, rotated)).rejects.toBeDefined();
    await expect(decryptSessionToken(first, original)).resolves.toBe("same-token");
    await expect(encryptSessionToken("x", "ab".repeat(64))).rejects.toThrow();
  });
});
