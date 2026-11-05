import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { getPlatformProxy } from "wrangler";
import { seedStaging } from "./seed-staging.js";
if (process.argv.length > 2)
  throw Error("Este comando solo prepara D1 emulada local, sin argumentos.");
const root = new URL("../", import.meta.url),
  configPath = fileURLToPath(new URL("wrangler.local.jsonc", root));
const config = JSON.parse(await readFile(configPath, "utf8"));
if (
  config.account_id ||
  config.name !== "jm-store-ecommerce-sdd-local" ||
  config.d1_databases.length !== 1 ||
  config.d1_databases[0].database_id ||
  config.d1_databases[0].remote !== false ||
  config.vars.ENVIRONMENT !== "local" ||
  config.vars.SESSION_NAMESPACE !== "jm-sdd-local" ||
  config.vars.DATABASE_IDENTITY !== "local-only" ||
  config.vars.REMOTE_ENABLED !== "false"
)
  throw Error("Config cloud no coincide con la identidad local aislada.");
try {
  await writeFile(
    new URL(".dev.vars", root),
    `QUOTE_SECRET=${randomBytes(32).toString("hex")}\nRATE_LIMIT_SECRET=${randomBytes(32).toString("hex")}\n`,
    { flag: "wx", mode: 0o600 },
  );
} catch (error) {
  if (error.code !== "EEXIST") throw error;
}
const cli = fileURLToPath(
  new URL("../../node_modules/wrangler/bin/wrangler.js", import.meta.url),
);
const localEnv = { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" };
for (const k of [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_API_KEY",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_EMAIL",
])
  delete localEnv[k];
const r = spawnSync(
  process.execPath,
  [
    cli,
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "--config",
    configPath,
    "--persist-to",
    fileURLToPath(new URL(".wrangler/local", root)),
  ],
  { cwd: fileURLToPath(root), env: localEnv, stdio: "inherit" },
);
if (r.status !== 0) process.exit(r.status ?? 1);
const proxy = await getPlatformProxy({
  configPath,
  persist: { path: fileURLToPath(new URL(".wrangler/local/v3", root)) },
  remoteBindings: false,
});
try {
  await seedStaging(proxy.env.DB, { localOnly: true });
  console.log(
    "D1 local preparada con catálogo sintético. npm run cloud:dev abre localhost:8787.",
  );
} finally {
  await proxy.dispose();
}
