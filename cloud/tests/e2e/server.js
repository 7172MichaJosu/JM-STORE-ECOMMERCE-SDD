import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { seedStaging } from "../../scripts/seed-staging.js";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const options = convertV4MiniflareOptions({
  modules: true,
  scriptPath: root + "cloud/dist/worker.js",
  compatibilityDate: "2026-11-04",
  compatibilityFlags: ["nodejs_compat"],
  host: "127.0.0.1",
  port: 8788,
  d1Databases: ["DB"],
  d1Persist: false,
  bindings: {
    ENVIRONMENT: "local",
    APP_ORIGIN: "http://127.0.0.1:8788",
    SESSION_NAMESPACE: "jm-sdd-e2e",
    DATABASE_IDENTITY: "local-only",
    REMOTE_ENABLED: "false",
    QUOTE_SECRET: randomBytes(32).toString("hex"),
    RATE_LIMIT_SECRET: randomBytes(32).toString("hex"),
  },
  assets: {
    directory: root + "client/dist",
    binding: "ASSETS",
    run_worker_first: ["/api", "/api/*"],
    routerConfig: { has_user_worker: true },
    assetConfig: { not_found_handling: "single-page-application" },
  },
});
const mf = new Miniflare({
  ...options,
  enableDevRegistry: false,
  telemetry: { enabled: false },
});
await mf.ready;
const db = await mf.getD1Database("DB");
for (const file of (await readdir(root + "cloud/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort())
  await db.exec(await readFile(root + "cloud/migrations/" + file, "utf8"));
await seedStaging(db, { localOnly: true });
console.log("Worker/D1 sintéticos listos en loopback.");
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, async () => {
    await mf.dispose();
    process.exit(0);
  });
