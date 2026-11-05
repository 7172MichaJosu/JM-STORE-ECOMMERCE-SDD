import { copyFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const images = readdirSync(new URL("../../client/public/images/demo/", import.meta.url)).filter(name => /^[a-z0-9-]+\.(jpg|webp|png)$/.test(name)).map(name => ({ path: "/images/demo/" + name, alt: name.replace(/\.[^.]+$/, "").replaceAll("-", " ") }));
writeFileSync(new URL("../src/assets/library.json", import.meta.url), JSON.stringify(images, null, 2) + "\n");
copyFileSync(
  new URL("../src/assets/_headers", import.meta.url),
  new URL("../../client/dist/_headers", import.meta.url),
);
const cli = fileURLToPath(
  new URL("../../node_modules/wrangler/bin/wrangler.js", import.meta.url),
);
const isolatedEnv = { ...process.env, WRANGLER_SEND_METRICS: "false" };
for (const key of [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_API_KEY",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_EMAIL",
])
  delete isolatedEnv[key];
const r = spawnSync(
  process.execPath,
  [
    cli,
    "deploy",
    "--dry-run",
    "--config",
    "wrangler.staging.jsonc",
    "--outdir",
    "dist",
  ],
  {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    stdio: "inherit",
    env: isolatedEnv,
  },
);
process.exitCode = r.status ?? 1;
