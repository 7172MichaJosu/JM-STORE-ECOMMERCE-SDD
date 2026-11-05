import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { seedStaging } from "../../scripts/seed-staging.js";
import { hashPassword } from "../../../server/src/lib/passwords.js";
import { firebaseDouble } from "../fixtures/firebase-double.js";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const firebase = process.env.JM_FIREBASE_TEST_MODE === "1" ? firebaseDouble({ actionsFile: process.env.JM_FIREBASE_ACTIONS_FILE }) : null;
const options = convertV4MiniflareOptions({
  modules: true,
  scriptPath: root + "cloud/dist/worker.js",
  compatibilityDate: "2026-11-04",
  compatibilityFlags: ["nodejs_compat"],
  host: "127.0.0.1",
  port: 8788,
  d1Databases: ["DB"],
  d1Persist: false,
  outboundService: request => firebase ? firebase.fetch(request) : new Response("External requests disabled", { status: 503 }),
  bindings: {
    ENVIRONMENT: "local",
    APP_ORIGIN: "http://127.0.0.1:8788",
    SESSION_NAMESPACE: "jm-sdd-e2e",
    DATABASE_IDENTITY: "local-only",
    REMOTE_ENABLED: "false",
    QUOTE_SECRET: randomBytes(32).toString("hex"),
    RATE_LIMIT_SECRET: randomBytes(32).toString("hex"),
    ...(firebase ? { FIREBASE_PROJECT_ID: firebase.projectId, FIREBASE_API_KEY: firebase.apiKey, FIREBASE_SESSION_ENCRYPTION_KEY: randomBytes(32).toString("hex") } : {}),
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
  .sort()) {
  const sql = await readFile(root + "cloud/migrations/" + file, "utf8");
  if (file === "0003_firebase_identity_security.sql") {
    for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean))
      await db.prepare(statement).run();
  } else await db.exec(sql);
}
await seedStaging(db, { localOnly: true });
for (const admin of JSON.parse(process.env.JM_TEST_ADMINS || "[]")) {
  const date = new Date().toISOString();
  if (firebase) {
    const identity = firebase.addAccount(admin.email, admin.password);
    await db.prepare("INSERT INTO users(role_id,email,name,password_hash,created_at,updated_at,auth_provider,firebase_uid) VALUES(2,?,'Admin synthetic',?,?,?,'FIREBASE',?)")
      .bind(admin.email, `firebase-managed:${identity.uid}`, date, date, identity.uid).run();
  } else {
    await db.prepare("INSERT INTO users(role_id,email,name,password_hash,created_at,updated_at) VALUES((SELECT id FROM roles WHERE code='ADMIN'),?,'Administrador sintético',?,?,?)")
      .bind(admin.email, await hashPassword(admin.password), date, date).run();
  }
}
console.log("Worker/D1 sintéticos listos en loopback.");
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, async () => {
    await mf.dispose();
    process.exit(0);
  });
