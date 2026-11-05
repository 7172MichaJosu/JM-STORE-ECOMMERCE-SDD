import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
export default defineConfig({
  plugins: [
    cloudflareTest({
      remoteBindings: false,
      // Configure the test Worker directly: never load the operator's .dev.vars.
      main: fileURLToPath(new URL("./src/worker.js", import.meta.url)),
      miniflare: {
        compatibilityDate: "2026-11-04",
        compatibilityFlags: ["nodejs_compat"],
        d1Databases: ["DB"],
        outboundService: () => new Response("External requests disabled in local tests", { status: 503 }),
        bindings: {
          ENVIRONMENT: "local",
          APP_ORIGIN: "http://localhost:8787",
          SESSION_NAMESPACE: "jm-sdd-tests",
          DATABASE_IDENTITY: "local-only",
          REMOTE_ENABLED: "false",
          TEST_MIGRATIONS: await readD1Migrations(
            fileURLToPath(new URL("./migrations", import.meta.url)),
          ),
          QUOTE_SECRET: randomBytes(32).toString("hex"),
          RATE_LIMIT_SECRET: randomBytes(32).toString("hex"),
        },
      },
    }),
  ],
  test: {
    include: [
      "tests/unit/**/*.test.js",
      "tests/integration/**/*.test.js",
      "tests/contract/**/*.test.js",
    ],
    setupFiles: ["./tests/setup.js"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
