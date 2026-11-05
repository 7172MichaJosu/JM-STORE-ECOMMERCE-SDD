import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomBytes, createHmac } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { signQuote, readQuote } from "../../server/src/lib/quotes.js";

// Local preparation only. This script deliberately has no Cloudflare client.
const root = fileURLToPath(new URL("../../", import.meta.url));
const names = ["QUOTE_SECRET", "RATE_LIMIT_SECRET"];
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
try {
  if (process.argv.length !== 2) throw Error("No arguments accepted.");
  const values = parseEnv(await readFile(new URL("../.dev.vars", import.meta.url), "utf8"));
  if (names.some(name => typeof values[name] !== "string" || values[name].length < 32)) throw Error("Missing source secrets.");
  const scanValues = { ...values };
  try {
    const staged = JSON.parse(await readFile(new URL("../private/staging-secret-rotation.json", import.meta.url), "utf8"));
    for (const name of names) scanValues[`STAGING_${name}`] = staged[name];
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  for (const [file, label] of [["staging-synthetic-admin.json", "STAGING_ADMIN_PASSWORD"], ["staging-smoke-customer.json", "STAGING_CUSTOMER_PASSWORD"]]) {
    try { scanValues[label] = JSON.parse(await readFile(new URL("../private/" + file, import.meta.url), "utf8")).password; }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const currentSecrets = ["QUOTE_SECRET", "RATE_LIMIT_SECRET", "FIREBASE_SESSION_ENCRYPTION_KEY", "FIREBASE_API_KEY", "STAGING_QUOTE_SECRET", "STAGING_RATE_LIMIT_SECRET", "STAGING_ADMIN_PASSWORD", "STAGING_CUSTOMER_PASSWORD"].filter(name => scanValues[name]?.length >= 20);
  const publicFiles = [...new Set(git("ls-files", "--cached", "--others", "--exclude-standard", "-z").split("\0").filter(Boolean))];
  const publicMatches = [];
  for (const path of publicFiles) {
    let content;
    try { content = await readFile(new URL(path.replaceAll("\\", "/"), new URL("../../", import.meta.url))); } catch { continue; }
    const found = currentSecrets.filter(name => content.includes(Buffer.from(scanValues[name])));
    if (found.length) publicMatches.push({ file: path, fields: found });
  }
  const revisions = git("rev-list", "--all").trim().split(/\s+/).filter(Boolean);
  const history = revisions.length ? spawnSync("git", ["grep", "-I", "-l", "-F", "-f", "-", ...revisions, "--"], { cwd: root, encoding: "utf8", input: currentSecrets.map(name => scanValues[name]).join("\n") + "\n" }) : { status: 1, stdout: "" };
  if (![0, 1].includes(history.status)) throw Error("History inspection failed.");
  const historyMatches = history.stdout.trim().split(/\r?\n/).filter(Boolean);
  const privateDir = new URL("../private/", import.meta.url);
  await mkdir(privateDir, { recursive: true });
  const candidatePath = new URL("staging-secret-rotation.json", privateDir);
  let candidates;
  try { candidates = JSON.parse(await readFile(candidatePath, "utf8")); }
  catch (error) {
    if (error.code !== "ENOENT") throw Error("Existing preparation cannot be read.");
    candidates = Object.fromEntries(names.map(name => [name, randomBytes(32).toString("hex")]));
    await writeFile(candidatePath, JSON.stringify(candidates) + "\n", { flag: "wx", mode: 0o600 });
  }
  const distinct = names.every(name => /^[\da-f]{64}$/i.test(candidates[name]) && !Object.values(values).includes(candidates[name])) && candidates.QUOTE_SECRET !== candidates.RATE_LIMIT_SECRET;
  if (!distinct || Object.keys(candidates).length !== names.length) throw Error("Candidates are not independent.");
  const ignored = git("check-ignore", "cloud/private/staging-secret-rotation.json").trim().length > 0;
  if (!ignored) throw Error("Private preparation is not ignored.");
  if (process.platform === "win32") {
    const who = execFileSync("whoami", [], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    execFileSync("icacls", [fileURLToPath(candidatePath), "/inheritance:r", "/grant:r", `${who}:(F)`], { stdio: "pipe" });
  }
  const synthetic = { exp: Date.now() + 60_000, test: "rotation-preparation" };
  let rejectsOldQuote = false;
  try { readQuote(signQuote(synthetic, values.QUOTE_SECRET), candidates.QUOTE_SECRET); } catch { rejectsOldQuote = true; }
  const rateNamespaceChanges = createHmac("sha256", values.RATE_LIMIT_SECRET).update("synthetic-rate-bucket").digest("hex") !== createHmac("sha256", candidates.RATE_LIMIT_SECRET).update("synthetic-rate-bucket").digest("hex");
  const passed = !publicMatches.length && !historyMatches.length && rejectsOldQuote && rateNamespaceChanges;
  console.log(JSON.stringify({ passed, compromisedByOperatorReport: names, publicFilesScanned: publicFiles.length, publicMatches, gitRevisionsScanned: revisions.length, historyMatchingPaths: historyMatches, candidateFile: "cloud/private/staging-secret-rotation.json", privateFileIgnored: ignored, windowsUserOnlyAclApplied: process.platform === "win32", candidatesIndependent: distinct, oldQuotesRejectedByNewKey: rejectsOldQuote, rateNamespaceChanges, localActiveSecretsReplaced: false, remoteOperationPerformed: false, networkRequests: 0 }, null, 2));
  if (!passed) process.exitCode = 1;
} catch {
  console.error("Secret rotation preparation failed safely. No secret values were printed; no remote operation was attempted.");
  process.exitCode = 1;
}
