import { defineConfig } from "@playwright/test";
import base from "./playwright.config.js";
export default defineConfig({ ...base, testMatch: ["firebase-admin-security.spec.js", "customer-store.spec.js", "admin-commerce.spec.js", "cart-optimistic.spec.js"], outputDir: "./test-results-firebase", preserveOutput: "never", use: { ...base.use, trace: "off", screenshot: "off", video: "off" } });
