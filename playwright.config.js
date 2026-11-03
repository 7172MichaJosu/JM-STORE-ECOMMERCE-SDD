import { defineConfig } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
process.env.TEST_ADMIN_PASSWORD ||= randomUUID();
process.env.TEST_ADMIN_EMAIL ||= "admin@example.test";
process.env.E2E_DATABASE ||= path.join(
  tmpdir(),
  "jm-e2e-" + randomUUID() + ".sqlite",
);
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "*.spec.js",
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  use: {
    baseURL: "http://localhost:3101",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node tests/e2e/server.js",
    url: "http://localhost:3101/api/health",
    reuseExistingServer: false,
    timeout: 30000,
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
