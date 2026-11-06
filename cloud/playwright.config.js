import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["customer-store.spec.js", "admin-security.spec.js", "cart-optimistic.spec.js"],
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  use: { baseURL: "http://127.0.0.1:8788", headless: true, trace: "off" },
  reporter: "list",
  outputDir: "./test-results",
  webServer: {
    command: "node cloud/tests/e2e/server.js",
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    url: "http://127.0.0.1:8788/api/health",
    reuseExistingServer: false,
    timeout: 45000,
  },
});
