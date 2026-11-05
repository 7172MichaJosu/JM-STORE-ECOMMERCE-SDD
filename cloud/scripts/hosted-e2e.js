import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checkTarget } from "./targets.js";
import { readFile } from "node:fs/promises";
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
const result = spawnSync(
  process.execPath,
  [playwright, "test", "--config", "cloud/playwright.hosted.config.js"],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      JM_STORE_STAGING_ORIGIN: target.origin,
    },
  },
);
process.exitCode = result.status ?? 1;
