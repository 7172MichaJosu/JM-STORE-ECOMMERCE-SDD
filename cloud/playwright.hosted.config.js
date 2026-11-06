import { defineConfig } from "@playwright/test";

const origin = process.env.JM_STORE_STAGING_ORIGIN;
const cart = process.env.JM_CART_FEEDBACK_TESTS === "1";
if (!origin || new URL(origin).origin !== origin || !origin.endsWith(".workers.dev"))
  throw Error("Configura explícitamente el origen workers.dev de staging.");

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: cart ? ["cart-optimistic.spec.js"] : ["customer-store.spec.js", "hosted-auth.spec.js", "admin-commerce.spec.js"],
  // The API commerce suite creates isolated products for rejected/retried payments.
  // Avoid spending stock from existing catalogue items in the browser suite.
  grep: cart ? /carrito:/ : /Workers: assets|staging|panel completo/,
  grepInvert: cart ? /checkout espera/ : undefined,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 20000 },
  use: { baseURL: origin, headless: true, trace: "off" },
  reporter: "list",
  outputDir: "./test-results-hosted",
});
