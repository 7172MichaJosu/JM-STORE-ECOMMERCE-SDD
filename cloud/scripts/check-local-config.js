import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { configuration } from "../src/config.js";
import { encryptSessionToken, decryptSessionToken } from "../src/security/token-vault.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
const required = ["FIREBASE_PROJECT_ID", "FIREBASE_API_KEY", "FIREBASE_SESSION_ENCRYPTION_KEY", "QUOTE_SECRET", "RATE_LIMIT_SECRET"];
try {
  const source = await readFile(new URL("../.dev.vars", import.meta.url), "utf8");
  const values = parseEnv(source);
  const fields = Object.fromEntries(required.map(name => [name, values[name] && !/[<>]|replace[-_ ]?me|your[-_ ]?(key|project)/i.test(values[name]) ? "PRESENT" : "MISSING_OR_PLACEHOLDER"]));
  const duplicateKeys = required.filter(name => (source.match(new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`, "gm")) || []).length > 1);
  const ignored = git("check-ignore", "cloud/.dev.vars").trim() === "cloud/.dev.vars";
  const tracked = git("ls-files", "--", "cloud/.dev.vars").trim().length > 0;
  let runtime = false, encryption = false;
  try {
    const config = configuration({ ...values, DB: { prepare() {} }, ENVIRONMENT: "local", APP_ORIGIN: "http://localhost:8787", SESSION_NAMESPACE: "preflight-only", DATABASE_IDENTITY: "local-only" });
    runtime = Boolean(config.firebase) && new Set([values.QUOTE_SECRET, values.RATE_LIMIT_SECRET, values.FIREBASE_SESSION_ENCRYPTION_KEY]).size === 3;
    const synthetic = "local-configuration-check";
    encryption = await decryptSessionToken(await encryptSessionToken(synthetic, values.FIREBASE_SESSION_ENCRYPTION_KEY), values.FIREBASE_SESSION_ENCRYPTION_KEY) === synthetic;
  } catch { /* Report status only: never serialize a config object or error body. */ }
  const passed = Object.values(fields).every(status => status === "PRESENT") && !duplicateKeys.length && ignored && !tracked && runtime && encryption;
  console.log(JSON.stringify({ passed, fields, duplicateKeys, ignored, tracked, runtimeConfiguration: runtime, encryptionRoundTrip: encryption, networkRequests: 0, providerCredentialsVerified: false, firebaseConsoleSettings: "REQUIRES_AUTHORIZED_REMOTE_VERIFICATION" }, null, 2));
  if (!passed) process.exitCode = 1;
} catch {
  console.error("Local configuration preflight failed; no secret values were printed and no network requests were made.");
  process.exitCode = 1;
}
