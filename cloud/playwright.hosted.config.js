import { defineConfig } from "@playwright/test";

const origin = process.env.JM_STORE_STAGING_ORIGIN;
if (!origin || new URL(origin).origin !== origin || !origin.endsWith(".workers.dev"))
  throw Error("Configura explícitamente el origen workers.dev de staging.");

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["customer-store.spec.js", "hosted-auth.spec.js"],
  workers: 1,
  timeout: 90000,
  expect: { timeout: 20000 },
  use: { baseURL: origin, headless: true, trace: "off" },
  reporter: "list",
  outputDir: "./test-results-hosted",
});
