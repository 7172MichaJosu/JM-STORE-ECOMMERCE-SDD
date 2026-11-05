import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checkTarget } from "./targets.js";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const target = await checkTarget(process.argv.slice(2));
if (target.environment !== "staging")
  throw Error("Las pruebas alojadas solo admiten --target staging.");
const session = JSON.parse(await readFile(new URL("../private/staging-current-session.json", import.meta.url), "utf8"));
if (session.resourceGate?.blocked)
  throw Error("R-AUTH bloqueado: pruebas remotas detenidas hasta nueva autorización.");

const cloudDir = fileURLToPath(new URL("../", import.meta.url));
const config = JSON.parse(
  await readFile(join(cloudDir, "wrangler.staging.jsonc"), "utf8"),
);
if (
  config.name !== target.worker ||
  config.account_id !== target.accountId ||
  config.d1_databases?.length !== 1 ||
  config.d1_databases[0].database_id !== target.databaseId ||
  config.vars?.APP_ORIGIN !== target.origin ||
  config.vars?.ENVIRONMENT !== "staging" ||
  config.vars?.REMOTE_ENABLED !== "true" ||
  config.workers_dev !== true
)
  throw Error("El destino alojado no coincide con la allowlist de staging.");

const root = fileURLToPath(new URL("../../", import.meta.url));
const playwright = join(root, "node_modules", "playwright", "cli.js");
const admin = JSON.parse(await readFile(new URL("../private/staging-synthetic-admin.json", import.meta.url), "utf8"));
if (!admin.synthetic || !/^jm-sdd-stage-[\da-f-]+@example\.test$/.test(admin.email)) throw Error("Synthetic ADMIN required; personal account prohibited.");
const result = spawnSync(
  process.execPath,
  [playwright, "test", "--config", "cloud/playwright.hosted.config.js", "--reporter", "json"],
  {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", maxBuffer: 20 * 1024 * 1024,
    env: {
      ...process.env,
      JM_STORE_STAGING_ORIGIN: target.origin,
      TEST_ADMIN_EMAIL: admin.email,
      TEST_ADMIN_PASSWORD: admin.password,
    },
  },
);
await writeFile(new URL("../private/hosted-playwright-results.json", import.meta.url), result.stdout || "{}", { mode: 0o600 });
try {
  const report = JSON.parse(result.stdout);
  const tests = [];
  function visit(suites) { for (const suite of suites || []) { for (const spec of suite.specs || []) tests.push({ title: spec.title, passed: spec.ok, statuses: spec.tests.flatMap(test => test.results.map(run => run.status)) }); visit(suite.suites); } }
  visit(report.suites);
  console.log(JSON.stringify({ tests, stats: report.stats, credentialsPrinted: false, detailedReportPrivate: true }));
} catch { console.error(JSON.stringify({ reportUnavailable: true, exitCode: result.status, privateOutputWithheld: true })); }
process.exitCode = result.status ?? 1;
