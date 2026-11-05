import { afterEach, describe, expect, it, vi } from "vitest";
import { createSign, generateKeyPairSync } from "node:crypto";
import { verifyFirebaseIdToken } from "../../src/security/firebase-id-token.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" });
jwk.kid = "synthetic-key";
jwk.alg = "RS256";
jwk.use = "sig";
const encoded = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
function token(claims, kid = "synthetic-key") {
  const head = encoded({ alg: "RS256", typ: "JWT", kid });
  const body = encoded(claims);
  const signer = createSign("RSA-SHA256");
  signer.update(`${head}.${body}`);
  return `${head}.${body}.${signer.sign(privateKey).toString("base64url")}`;
}
const claims = (overrides = {}) => ({
  iss: "https://securetoken.google.com/jm-test",
  aud: "jm-test",
  sub: "synthetic-uid",
  user_id: "synthetic-uid",
  iat: Math.floor(Date.now() / 1000) - 10,
  auth_time: Math.floor(Date.now() / 1000) - 20,
  exp: Math.floor(Date.now() / 1000) + 300,
  email: "synthetic@example.com",
  email_verified: true,
  firebase: { sign_in_provider: "password" },
  ...overrides,
});
afterEach(() => vi.unstubAllGlobals());

describe("Firebase ID token verification", () => {
  it("verifies RS256, signing key and required Firebase claims", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200, headers: { "cache-control": "public, max-age=300" } })));
    await expect(verifyFirebaseIdToken(token(claims()), "jm-test")).resolves.toMatchObject({ uid: "synthetic-uid", email: "synthetic@example.com", emailVerified: true });
  });
  it.each([
    ["aud", { aud: "other" }], ["iss", { iss: "https://securetoken.google.com/other" }],
    ["expiry", { exp: Math.floor(Date.now() / 1000) - 120 }], ["issued-at", { iat: Math.floor(Date.now() / 1000) + 120 }],
    ["subject", { sub: "" }], ["auth-time", { auth_time: Math.floor(Date.now() / 1000) + 120 }], ["tenant", { firebase: { sign_in_provider: "password", tenant: "other-tenant" } }],
    ["future-iat-outside-approved-skew", { iat: Math.floor(Date.now() / 1000) + 45 }],
    ["unexpected-provider", { firebase: { sign_in_provider: "google.com" } }],
  ])("rejects invalid %s claims", async (_label, changes) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200 })));
    await expect(verifyFirebaseIdToken(token(claims(changes)), "jm-test")).rejects.toMatchObject({ code: "INVALID_ID_TOKEN" });
  });
  it("rejects unknown key IDs and invalid signatures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200 })));
    await expect(verifyFirebaseIdToken(token(claims({ sub: "other" })), "jm-test")).resolves.toMatchObject({ uid: "other" });
    const parts = token(claims()).split(".");
    parts[2] = encoded("tampered");
    await expect(verifyFirebaseIdToken(parts.join("."), "jm-test")).rejects.toMatchObject({ code: "INVALID_ID_TOKEN" });
  });
  it("fails closed when Firebase signing keys cannot be fetched", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network unavailable"); }));
    await expect(verifyFirebaseIdToken(token(claims(), "unavailable-key"), "jm-test")).rejects.toMatchObject({ code: "INVALID_ID_TOKEN" });
  });
  it("does not retain an imported key across expired JWKS with a reused kid", async () => {
    const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const replacement = { ...pair.publicKey.export({ format: "jwk" }), kid: jwk.kid, alg: "RS256", use: "sig" };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ keys: [jwk] }), { headers: { "cache-control": "max-age=60" } })));
    // Unknown kid forces a fresh JWKS before warming the actual key.
    await expect(verifyFirebaseIdToken(token(claims(), "force-cache-reset"), "jm-test")).rejects.toBeDefined();
    await expect(verifyFirebaseIdToken(token(claims()), "jm-test")).resolves.toMatchObject({ uid: "synthetic-uid" });
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61_000);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ keys: [replacement] }), { headers: { "cache-control": "max-age=60" } })));
    try {
      await expect(verifyFirebaseIdToken(token(claims()), "jm-test")).rejects.toMatchObject({ code: "INVALID_ID_TOKEN" });
    } finally { clock.mockRestore(); }
  });
});
