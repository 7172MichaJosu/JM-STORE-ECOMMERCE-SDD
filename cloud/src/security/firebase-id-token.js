const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
import { Buffer } from "node:buffer";
const SKEW_SECONDS = 30;
let cachedKeys;
let cacheUntil = 0;
const importedKeys = new WeakMap();

function invalid() {
  const error = new Error("Token de autenticación no válido.");
  error.code = "INVALID_ID_TOKEN";
  return error;
}
function decode(part) {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw invalid();
  return Buffer.from(part, "base64url");
}
function json(part) {
  try { return JSON.parse(new TextDecoder().decode(decode(part))); } catch { throw invalid(); }
}
async function keys(fetcher) {
  if (cachedKeys && Date.now() < cacheUntil) return cachedKeys;
  let response;
  try { response = await fetcher(JWKS_URL); } catch { throw invalid(); }
  if (!response.ok) throw invalid();
  const body = await response.json();
  if (!Array.isArray(body.keys)) throw invalid();
  const maxAge = Number(response.headers.get("cache-control")?.match(/max-age=(\d+)/i)?.[1] ?? 300);
  cachedKeys = body.keys;
  cacheUntil = Date.now() + Math.min(Math.max(maxAge, 60), 21600) * 1000;
  return cachedKeys;
}

export async function verifyFirebaseIdToken(token, projectId, { fetcher = fetch, now = Date.now() } = {}) {
  if (typeof token !== "string" || token.length > 8192) throw invalid();
  const parts = token.split(".");
  if (parts.length !== 3) throw invalid();
  const header = json(parts[0]);
  const payload = json(parts[1]);
  if (header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid) throw invalid();
  let key = (await keys(fetcher)).find((candidate) => candidate.kid === header.kid && candidate.alg === "RS256" && candidate.use === "sig");
  if (!key) {
    cachedKeys = null; cacheUntil = 0;
    key = (await keys(fetcher)).find((candidate) => candidate.kid === header.kid && candidate.alg === "RS256" && candidate.use === "sig");
  }
  if (!key) throw invalid();
  let cryptoKey;
  try {
    // Cache the public CryptoKey only while its exact JWKS object is current.
    // Expiry/rotation replaces that object, including a reused kid.
    if (!importedKeys.has(key)) importedKeys.set(key, crypto.subtle.importKey("jwk", key, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]));
    cryptoKey = await importedKeys.get(key);
  } catch { throw invalid(); }
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  let signatureValid = false;
  try { signatureValid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, decode(parts[2]), signed); } catch { throw invalid(); }
  if (!signatureValid) throw invalid();
  const seconds = Math.floor(now / 1000);
  if (payload.iss !== `https://securetoken.google.com/${projectId}` || payload.aud !== projectId ||
      typeof payload.sub !== "string" || payload.sub.length < 1 || payload.sub.length > 128 ||
      !Number.isInteger(payload.exp) || payload.exp <= seconds - SKEW_SECONDS ||
      !Number.isInteger(payload.iat) || payload.iat > seconds + SKEW_SECONDS ||
      !Number.isInteger(payload.auth_time) || payload.auth_time > seconds + SKEW_SECONDS ||
      payload.auth_time > payload.iat + SKEW_SECONDS) throw invalid();
  const firebase = payload.firebase;
  if (!firebase || firebase.sign_in_provider !== "password" || firebase.tenant !== undefined) throw invalid();
  return {
    uid: payload.sub,
    email: typeof payload.email === "string" ? payload.email.toLowerCase() : null,
    emailVerified: payload.email_verified === true,
    authTime: payload.auth_time,
    issuedAt: payload.iat,
    expiresAt: payload.exp,
    firebase,
  };
}
