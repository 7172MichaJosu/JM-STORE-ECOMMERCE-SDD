import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { randomBytes, randomUUID } from "node:crypto";
import { firebaseAuth } from "../src/security/firebase-auth.js";
import { verifyFirebaseIdToken } from "../src/security/firebase-id-token.js";
const local = parseEnv(await readFile(new URL("../.dev.vars", import.meta.url), "utf8"));
const preflight = JSON.parse(await readFile(new URL("../private/firebase-admin-preflight.json", import.meta.url), "utf8"));
if (!preflight.sparkBillingDisabled || preflight.identityPlatformEnabled || !preflight.apiKeyProjectMatches) throw Error("Verified Spark project required before synthetic accounts.");
let lastProviderError = null;
const fetcher = async (url, init) => {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.clone().json().catch(() => ({}));
    lastProviderError = String(body.error?.message || "PROVIDER_ERROR").split(/[ :]/)[0].replace(/[^A-Z_]/g, "");
  }
  return response;
};
const provider = firebaseAuth({ projectId: local.FIREBASE_PROJECT_ID, apiKey: local.FIREBASE_API_KEY, fetcher });
try {
  const file = new URL("../private/staging-synthetic-admin.json", import.meta.url);
  let account;
  try { account = JSON.parse(await readFile(file, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (!account) {
    const email = `jm-sdd-stage-${randomUUID()}@example.test`, password = "T!" + randomBytes(24).toString("base64url") + "a8";
    const identity = await provider.signUp(email, password);
    account = { uid: identity.uid, email, password, createdAt: new Date().toISOString(), synthetic: true };
    await writeFile(file, JSON.stringify(account), { mode: 0o600, flag: "wx" });
  }
  const identity = await provider.signIn(account.email, account.password);
  const claims = await verifyFirebaseIdToken(identity.idToken, local.FIREBASE_PROJECT_ID);
  const state = await provider.lookup(identity.idToken);
  let wrongPasswordRejected = false;
  try { await provider.signIn(account.email, "T!" + randomUUID() + "a8"); } catch { wrongPasswordRejected = true; }
  const result = { nativeFirebaseSignupOrResume: true, projectAndSignatureVerified: claims.uid === account.uid && identity.uid === account.uid, passwordLoginVerified: true, wrongPasswordRejected, lookupUidMatches: state.uid === account.uid, validSincePresent: state.validSince !== null, syntheticOnly: true, plaintextCredentialsPrinted: false, administratorNotProvisionedInD1Yet: true };
  await writeFile(new URL("../private/firebase-synthetic-preflight-result.json", import.meta.url), JSON.stringify(result), { mode: 0o600 });
  console.log(JSON.stringify(result, null, 2));
  if (!result.projectAndSignatureVerified || !wrongPasswordRejected || !result.lookupUidMatches || !result.validSincePresent) process.exitCode = 1;
} catch { console.error(JSON.stringify({ syntheticFirebasePreflightFailed: true, providerError: lastProviderError || "VERIFICATION_FAILED", noCredentialsPrinted: true })); process.exitCode = 1; }
