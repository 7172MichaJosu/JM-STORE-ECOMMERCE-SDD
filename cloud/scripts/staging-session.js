import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { parseEnv } from "node:util";
import { checkTarget } from "./targets.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const cli = join(root, "node_modules/wrangler/bin/wrangler.js");
const config = join(root, "cloud/wrangler.staging.jsonc");
const target = await checkTarget(["--target", "staging"]);
const configured = JSON.parse(await readFile(config, "utf8"));
if (target.worker !== "jm-store-ecommerce-sdd-staging" || target.databaseId !== "ce073401-aae5-4889-8d32-047010650987" || configured.name !== target.worker || configured.account_id !== target.accountId || configured.d1_databases[0].database_id !== target.databaseId) throw Error("Staging target mismatch.");
const privateRoot = join(root, "cloud/private");
await mkdir(privateRoot, { recursive: true });
const env = { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" };
for (const key of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_API_KEY", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_EMAIL"]) delete env[key];
const wrangler = (args, sensitive = false) => {
  try { return execFileSync(process.execPath, [cli, ...args, "--config", config], { cwd: root, env, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 20 * 1024 * 1024, timeout: 180_000 }); }
  catch (error) {
    if (sensitive) throw Error("Sensitive Wrangler operation failed; output withheld.");
    const diagnostic = String(error.stdout || "") + String(error.stderr || "");
    // These staging CLI operations contain only paths, aggregate SQL and version IDs.
    // Never use this wrapper for inline secret arguments.
    throw Error(`Wrangler ${args.slice(0, 3).join(" ")} failed: ${diagnostic.replace(/\u001b\[[0-9;]*m/g, "").slice(-1800)}`);
  }
};
const privateJson = async (file, value) => writeFile(file, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
function protect(path) {
  if (process.platform === "win32") {
    const who = execFileSync("whoami", [], { encoding: "utf8" }).trim();
    execFileSync("icacls", [path, "/inheritance:r", "/grant:r", `${who}:(OI)(CI)F`], { stdio: "pipe" });
  }
}
async function cf(path, raw = false) {
  const auth = await readFile(join(process.env.APPDATA, "xdg.config/.wrangler/config/default.toml"), "utf8");
  const token = auth.match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)?.[1];
  if (!token) throw Error("Wrangler authentication unavailable.");
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${target.accountId}/${path}`, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw Error(`Cloudflare read ${path} returned ${response.status}.`);
  if (raw) return new Uint8Array(await response.arrayBuffer());
  const data = await response.json();
  if (!data.success) throw Error("Cloudflare read was unsuccessful.");
  return data.result;
}
try {
  const phase = process.argv[2];
  if (["migrate", "prepare", "provision-admin", "deploy"].includes(phase)) {
    const currentSession = JSON.parse(await readFile(join(privateRoot, "staging-current-session.json"), "utf8"));
    if (currentSession.resourceGate?.blocked) throw Error("R-AUTH resource gate is blocked. New operator authorization is required before further staging operations.");
  }
  if (phase === "backup") {
    const settings = await cf("workers/account-settings");
    // Billing visibility is not part of Wrangler's OAuth scopes. Backups remain read-only.
    const subscriptions = await cf("subscriptions").catch(() => null);
    const paid = (subscriptions || []).filter(s => /worker/i.test(JSON.stringify(s.rate_plan || s)) && Number(s.price || s.rate_plan?.price || 0) > 0);
    if (paid.length) throw Error("Paid Workers subscription detected; stop before staging changes.");
    const directory = join(privateRoot, `staging-backup-${new Date().toISOString().replace(/[:.]/g, "-")}`);
    await mkdir(directory); protect(directory);
    const deployments = JSON.parse(wrangler(["deployments", "list", "--json"]));
    const active = deployments.at(-1);
    await privateJson(join(directory, "deployments.json"), deployments);
    await privateJson(join(directory, "worker-settings.json"), await cf(`workers/scripts/${target.worker}/settings`));
    await writeFile(join(directory, "worker-content.multipart"), await cf(`workers/scripts/${target.worker}`, true), { mode: 0o600 });
    await writeFile(join(directory, "wrangler.staging.json"), JSON.stringify(configured, null, 2), { mode: 0o600 });
    const sqlPath = join(directory, "database.sql");
    wrangler(["d1", "export", "DB", "--remote", "--output", sqlPath]);
    const sql = await readFile(sqlPath);
    if (sql.length < 100) throw Error("Database export is empty.");
    const restored = new DatabaseSync(join(directory, "restore-verification.sqlite"));
    restored.exec(sql.toString("utf8"));
    const integrity = restored.prepare("PRAGMA integrity_check").get().integrity_check;
    const foreignKeyErrors = restored.prepare("PRAGMA foreign_key_check").all().length;
    const tables = restored.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all().map(row => row.name);
    const sourceRows = [];
    for (let index = 0; index < tables.length; index += 5) {
      const query = tables.slice(index, index + 5).map(name => `SELECT '${name.replaceAll("'", "''")}' name,COUNT(*) count FROM "${name.replaceAll('"','""')}"`).join(" UNION ALL ");
      sourceRows.push(...JSON.parse(wrangler(["d1", "execute", "DB", "--remote", "--command", query, "--json"]))[0].results);
    }
    const countsMatch = sourceRows.every(row => restored.prepare(`SELECT COUNT(*) count FROM "${row.name.replaceAll('"','""')}"`).get().count === row.count);
    restored.close();
    if (integrity !== "ok" || foreignKeyErrors || !countsMatch) throw Error("Backup restore verification failed.");
    const manifest = { createdAt: new Date().toISOString(), target, activeVersion: active.versions, sha256: createHash("sha256").update(sql).digest("hex"), exportBytes: sql.length, tables: tables.length, integrity, foreignKeyErrors, countsMatch, verified: true, accountSettings: settings, billingVisible: subscriptions !== null, workerPaidSubscriptions: subscriptions ? paid.length : null, subscriptionNames: subscriptions?.map(s => s.rate_plan?.public_name || s.rate_plan?.id || "unknown") ?? [] };
    await privateJson(join(directory, "manifest.json"), manifest);
    const previous = await readFile(join(privateRoot, "staging-current-session.json"), "utf8").then(JSON.parse).catch(() => ({}));
    await privateJson(join(directory, "previous-session.json"), previous);
    await privateJson(join(privateRoot, "staging-current-session.json"), { ...previous, directory, ...manifest });
    console.log(JSON.stringify({ backupVerified: true, exportBytes: sql.length, restoredTables: tables.length, integrity, foreignKeyErrors, countsMatch, activeVersion: active.versions, workerPaidSubscriptions: manifest.workerPaidSubscriptions, billingVisible: manifest.billingVisible, accountSettings: settings, subscriptionNames: manifest.subscriptionNames }, null, 2));
  } else if (phase === "migrate") {
    const sessionFile = join(privateRoot, "staging-current-session.json");
    const session = JSON.parse(await readFile(sessionFile, "utf8"));
    if (!session.verified || session.target.databaseId !== target.databaseId || session.target.worker !== target.worker) throw Error("Verified staging backup required.");
    const sql = await readFile(join(session.directory, "database.sql"));
    if (createHash("sha256").update(sql).digest("hex") !== session.sha256) throw Error("Backup digest mismatch.");
    const active = JSON.parse(wrangler(["deployments", "list", "--json"])).at(-1).versions;
    if (JSON.stringify(active) !== JSON.stringify(session.activeVersion)) throw Error("Worker changed since backup.");
    const stateQuery = "UPDATE deployment_state SET mode='CLOSED' WHERE id=1 AND database_identity='jm-store-ecommerce-d1-staging:ce073401-aae5-4889-8d32-047010650987'; SELECT mode,database_identity,schema_version FROM deployment_state WHERE id=1";
    const closed = JSON.parse(wrangler(["d1", "execute", "DB", "--remote", "--command", stateQuery, "--json"])).at(-1).results[0];
    if (closed.mode !== "CLOSED" || closed.database_identity !== configured.vars.DATABASE_IDENTITY) throw Error("Could not close verified staging database.");
    const result = wrangler(["d1", "migrations", "apply", "DB", "--remote"]);
    await writeFile(join(session.directory, "migration-output.txt"), result, { mode: 0o600 });
    const verification = JSON.parse(wrangler(["d1", "execute", "DB", "--remote", "--command", "SELECT name FROM d1_migrations ORDER BY id; SELECT name FROM pragma_table_info('users') WHERE name IN('auth_provider','firebase_uid'); SELECT name FROM pragma_table_info('credential_operations') WHERE name='apply_token'; PRAGMA foreign_key_check", "--json"]));
    const names = verification[0].results.map(row => row.name);
    if (!names.includes("0003_firebase_identity_security.sql") || !names.includes("0004_email_change_apply_cas.sql") || verification[1].results.length !== 2 || verification[2].results.length !== 1 || verification[3].results.length) throw Error("Remote migration verification failed; staging stays CLOSED.");
    session.migrations = { names, verifiedAt: new Date().toISOString(), foreignKeyErrors: 0, mode: "CLOSED" };
    await privateJson(sessionFile, session);
    console.log(JSON.stringify({ target: target.worker, backupRechecked: true, mode: "CLOSED", appliedMigrations: names, firebaseColumnsVerified: true, foreignKeyErrors: 0 }));
  } else if (phase === "prepare") {
    const sessionFile = join(privateRoot, "staging-current-session.json");
    const session = JSON.parse(await readFile(sessionFile, "utf8"));
    if (!session.verified || !session.migrations?.names.includes("0004_email_change_apply_cas.sql")) throw Error("Verified staging backup and migrations required.");
    const values = parseEnv(await readFile(join(root, "cloud/.dev.vars"), "utf8"));
    const rotation = JSON.parse(await readFile(join(privateRoot, "staging-secret-rotation.json"), "utf8"));
    const secrets = { QUOTE_SECRET: rotation.QUOTE_SECRET, RATE_LIMIT_SECRET: rotation.RATE_LIMIT_SECRET, FIREBASE_PROJECT_ID: values.FIREBASE_PROJECT_ID, FIREBASE_API_KEY: values.FIREBASE_API_KEY, FIREBASE_SESSION_ENCRYPTION_KEY: values.FIREBASE_SESSION_ENCRYPTION_KEY };
    if (Object.values(secrets).some(v => typeof v !== "string" || !v) || secrets.QUOTE_SECRET === values.QUOTE_SECRET || secrets.RATE_LIMIT_SECRET === values.RATE_LIMIT_SECRET || !/^[a-f0-9]{64}$/i.test(secrets.FIREBASE_SESSION_ENCRYPTION_KEY)) throw Error("Staging secrets failed validation.");
    const file = join(session.directory, "runtime-secrets.json");
    await privateJson(file, secrets);
    const current = JSON.parse(await readFile(config, "utf8"));
    current.vars.SESSION_NAMESPACE = "jm-sdd-staging-firebase-v1";
    const firebasePreflight = JSON.parse(await readFile(join(privateRoot, "firebase-admin-preflight.json"), "utf8"));
    current.vars.FIREBASE_EMAIL_ACTION_READY = String(firebasePreflight.emailActionMatches === true);
    current.observability = { enabled: true, head_sampling_rate: 1, logs: { enabled: true, invocation_logs: true } };
    await privateJson(config, current);
    const output = wrangler(["versions", "upload", "--secrets-file", file, "--tag", "firebase-staging-20261105", "--message", "Authorized synthetic staging Firebase integration and secret rotation"], true);
    const versionId = output.match(/Version ID:\s*([\da-f-]{36})/i)?.[1] || output.match(/Uploaded.*?([\da-f]{8}-[\da-f-]{27})/is)?.[1];
    if (!versionId) throw Error("Version uploaded but identifier could not be parsed; do not deploy.");
    session.preparedVersion = versionId;
    session.preparedAt = new Date().toISOString();
    session.secretNames = Object.keys(secrets);
    session.namespace = current.vars.SESSION_NAMESPACE;
    await privateJson(sessionFile, session);
    const active = JSON.parse(wrangler(["deployments", "list", "--json"])).at(-1).versions;
    console.log(JSON.stringify({ preparedVersion: versionId, activeVersion: active, liveVersionUnchanged: JSON.stringify(active) === JSON.stringify(session.activeVersion), secretsStoredWithoutPrinting: Object.keys(secrets), liveSecretsRotated: false, mode: "CLOSED", published: false }));
  } else if (phase === "provision-admin") {
    const file = join(privateRoot, "staging-synthetic-admin.json");
    const account = JSON.parse(await readFile(file, "utf8"));
    const proof = JSON.parse(await readFile(join(privateRoot, "firebase-synthetic-preflight-result.json"), "utf8"));
    if (!account.synthetic || !/^jm-sdd-stage-[\da-f-]+@example\.test$/.test(account.email) || !/^[\w-]{1,128}$/.test(account.uid) || !proof.projectAndSignatureVerified) throw Error("Only a newly verified synthetic Firebase identity can be provisioned.");
    const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
    const existing = JSON.parse(wrangler(["d1", "execute", "DB", "--remote", "--command", `SELECT u.id,u.firebase_uid,u.email,u.auth_provider,r.code role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.firebase_uid=${quote(account.uid)} OR u.email=${quote(account.email)}`, "--json"], true))[0].results;
    if (existing.length && !(existing.length === 1 && existing[0].firebase_uid === account.uid && existing[0].email === account.email && existing[0].role === "ADMIN" && existing[0].auth_provider === "FIREBASE")) throw Error("Identity collision; no email linking or promotion performed.");
    const date = new Date().toISOString();
    const sql = `${existing.length ? "" : `INSERT INTO users(role_id,email,name,password_hash,created_at,updated_at,auth_provider,firebase_uid) VALUES((SELECT id FROM roles WHERE code='ADMIN'),${quote(account.email)},'Admin staging synthetic',${quote('firebase-managed:' + account.uid)},${quote(date)},${quote(date)},'FIREBASE',${quote(account.uid)});`} INSERT OR IGNORE INTO email_claims(email,claim_kind,user_id,firebase_uid,created_at) SELECT email,'ACCOUNT',id,firebase_uid,${quote(date)} FROM users WHERE firebase_uid=${quote(account.uid)}; SELECT u.id,r.code role FROM users u JOIN roles r ON r.id=u.role_id WHERE firebase_uid=${quote(account.uid)}`;
    const record = JSON.parse(wrangler(["d1", "execute", "DB", "--remote", "--command", sql, "--json"], true)).at(-1).results[0];
    if (record.role !== "ADMIN") throw Error("Synthetic admin provisioning failed.");
    account.d1Provisioned = true; account.d1UserId = record.id;
    await privateJson(file, account);
    console.log(JSON.stringify({ syntheticAdminProvisioned: true, role: "ADMIN", exactFirebaseUidLink: true, credentialsPrinted: false, existingAccountsPromoted: false }));
  } else if (phase === "deploy") {
    const sessionFile = join(privateRoot, "staging-current-session.json");
    const session = JSON.parse(await readFile(sessionFile, "utf8"));
    const preflight = JSON.parse(await readFile(join(privateRoot, "firebase-admin-preflight.json"), "utf8"));
    if (!session.verified || !session.preparedVersion || !session.migrations || !preflight.sparkBillingDisabled || preflight.identityPlatformEnabled || !preflight.emailPasswordEnabled || !preflight.eepEnabled || !preflight.passwordPolicyMatches || !preflight.apiRestrictionsMatch || !preflight.apiKeyProjectMatches) throw Error("Staging preflight incomplete.");
    const latest = JSON.parse(await readFile(config, "utf8"));
    if (!preflight.emailActionMatches && latest.vars.FIREBASE_EMAIL_ACTION_READY !== "false") throw Error("Unconfigured email actions must be gated closed.");
    wrangler(["versions", "deploy", `${session.preparedVersion}@100%`, "--yes", "--message", "Authorized staging-only Firebase verification; email gate closed if unconfigured"], true);
    const deploymentStart = new Date().toISOString();
    const response = await fetch(target.origin + "/api/health");
    if (!response.ok) throw Error("Staging health failed; D1 remains CLOSED.");
    const verifiedState = JSON.parse(wrangler(["d1", "execute", "DB", "--remote", "--command", "UPDATE deployment_state SET mode='OPEN' WHERE id=1 AND database_identity='jm-store-ecommerce-d1-staging:ce073401-aae5-4889-8d32-047010650987'; SELECT mode FROM deployment_state WHERE id=1", "--json"])).at(-1).results[0];
    if (verifiedState.mode !== "OPEN") throw Error("Staging opening failed.");
    session.deployedVersion = session.preparedVersion;
    session.deployedAt = deploymentStart;
    session.liveSecretsRotated = true;
    session.emailActionReady = preflight.emailActionMatches;
    await privateJson(sessionFile, session);
    console.log(JSON.stringify({ deployedVersion: session.deployedVersion, stagingOnly: true, mode: "OPEN", secretsRotated: true, emailActionReady: session.emailActionReady, origin: target.origin }));
  } else throw Error("Unknown stage; no mutation attempted.");
} catch (error) {
  console.error(JSON.stringify({ stagingOperationFailed: true, phase: process.argv[2], reason: error.message?.startsWith("Command failed") ? "Wrangler command failed; raw output withheld to protect private data." : error.message }));
  process.exitCode = 1;
}
