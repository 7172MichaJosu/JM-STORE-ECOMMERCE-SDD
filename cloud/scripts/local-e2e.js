import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const admins = Array.from({ length: 5 }, () => ({ email: `${randomUUID()}@example.test`, password: randomUUID() }));
const firebase = process.argv.includes("--firebase");
const directory = firebase ? mkdtempSync(join(tmpdir(), "jm-store-firebase-test-")) : null;
const actionsFile = directory ? join(directory, "synthetic-actions.json") : "";
const result = spawnSync(process.execPath, [root + "node_modules/playwright/cli.js", "test", "--config", firebase ? "cloud/playwright.firebase.config.js" : "cloud/playwright.config.js", ...process.argv.slice(2).filter(arg => arg !== "--firebase")], {
  cwd: root, stdio: "inherit", env: { ...process.env, JM_TEST_ADMINS: JSON.stringify(admins), TEST_ADMIN_EMAIL: admins[3].email, TEST_ADMIN_PASSWORD: admins[3].password, JM_FIREBASE_TEST_MODE: firebase ? "1" : "0", JM_FIREBASE_ACTIONS_FILE: actionsFile },
});
if (directory) {
  try { unlinkSync(actionsFile); } catch (error) { if (error.code !== "ENOENT") throw error; }
  rmdirSync(directory);
}
process.exitCode = result.status ?? 1;
